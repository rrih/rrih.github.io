use crate::Result;
use percent_encoding::percent_decode_str;
use std::{
    env, fs,
    path::{Component, Path, PathBuf},
};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const REQUEST_WORKERS: usize = 8;

fn resolve(root: &Path, path: &str) -> std::result::Result<PathBuf, u16> {
    if path.as_bytes().iter().enumerate().any(|(i, b)| {
        *b == b'%'
            && (i + 2 >= path.len()
                || !path.as_bytes()[i + 1..i + 3]
                    .iter()
                    .all(u8::is_ascii_hexdigit))
    }) {
        return Err(400);
    }
    let decoded = percent_decode_str(path).decode_utf8().map_err(|_| 400u16)?;
    if decoded.contains('\0') {
        return Err(400);
    }
    let mut relative = PathBuf::new();
    for component in Path::new(decoded.trim_start_matches('/')).components() {
        match component {
            Component::ParentDir => {
                if !relative.pop() {
                    return Err(403);
                }
            }
            Component::Normal(value) => relative.push(value),
            Component::CurDir => (),
            _ => return Err(403),
        }
    }
    let file = root.join(relative);
    if file.exists()
        && !fs::canonicalize(&file)
            .map_err(|_| 403u16)?
            .starts_with(root)
    {
        return Err(403);
    }
    Ok(file)
}
fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name, value).expect("valid static HTTP header")
}

pub fn serve(directory: Option<String>) -> Result {
    let root = fs::canonicalize(
        directory
            .or_else(|| env::var("SITE_DIR").ok())
            .unwrap_or_else(|| "dist".into()),
    )?;
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "3342".into()).parse()?;
    let base = env::var("SITE_BASE").unwrap_or_else(|_| "/".into());
    if !base.starts_with('/') || !base.ends_with('/') {
        return Err("SITE_BASE must begin and end with a slash".into());
    }
    let server = Server::http(("127.0.0.1", port))?;
    println!(
        "Rust static preview: http://127.0.0.1:{port} ({})",
        root.display()
    );
    serve_requests(&server, &root, &base);
    Ok(())
}

fn serve_requests(server: &Server, root: &Path, base: &str) {
    // A throttled asset response must not block unrelated pages or translations.
    // Keep a bounded pool instead of spawning a thread for every asset request.
    std::thread::scope(|scope| {
        for _ in 0..REQUEST_WORKERS {
            scope.spawn(|| {
                for request in server.incoming_requests() {
                    respond(request, root, base);
                }
            });
        }
    });
}

fn respond(request: Request, root: &Path, base: &str) {
    let target = request.url().to_string();
    let (path, query) = target
        .split_once('?')
        .map_or((target.as_str(), ""), |(path, query)| (path, query));
    if base != "/" && path == base.trim_end_matches('/') {
        let location = format!(
            "{base}{}",
            if query.is_empty() {
                String::new()
            } else {
                format!("?{query}")
            }
        );
        let _ = request
            .respond(Response::empty(StatusCode(301)).with_header(header("Location", &location)));
        return;
    }
    // The Pictulane browser oracle verifies unrelated-worker isolation in a test-only build.
    if path == "/tools/other/sw.js"
        && base == "/tools/pictulane/"
        && root.join("TEST-ONLY").is_file()
    {
        let _ = request.respond(
            Response::from_string("self.addEventListener('install', () => self.skipWaiting())")
                .with_header(header("Content-Type", "text/javascript")),
        );
        return;
    }
    let mounted = path.strip_prefix(base).map(|p| format!("/{p}"));
    let Some(mounted) = mounted else {
        let _ = request
            .respond(Response::from_string("Page not found").with_status_code(StatusCode(404)));
        return;
    };
    let mut file = match resolve(root, &mounted) {
        Ok(file) => file,
        Err(status) => {
            let _ = request.respond(
                Response::from_string(if status == 400 {
                    "Bad request"
                } else {
                    "Forbidden"
                })
                .with_status_code(StatusCode(status)),
            );
            return;
        }
    };
    if request.method() != &Method::Get && request.method() != &Method::Head {
        let _ = request
            .respond(Response::empty(StatusCode(405)).with_header(header("Allow", "GET, HEAD")));
        return;
    }
    if file.is_dir() {
        if !path.ends_with('/') {
            let location = format!(
                "{path}/{}",
                if query.is_empty() {
                    String::new()
                } else {
                    format!("?{query}")
                }
            );
            let _ = request.respond(
                Response::empty(StatusCode(301)).with_header(header("Location", &location)),
            );
            return;
        }
        file.push("index.html");
    }
    let found = file.is_file();
    let response_file = if found {
        file.clone()
    } else {
        root.join("404.html")
    };
    let cache = if file
        .file_name()
        .is_some_and(|name| name == "sw.js" || name == "manifest.webmanifest")
    {
        "no-cache"
    } else {
        "public, max-age=600"
    };
    let content_type = match response_file.extension().and_then(|value| value.to_str()) {
        Some("webmanifest") => "application/manifest+json".to_string(),
        Some("wasm") => "application/wasm".to_string(),
        _ => mime_guess::from_path(&response_file)
            .first_or_octet_stream()
            .to_string(),
    };
    let result = match fs::File::open(&response_file) {
        Ok(file) => request.respond(
            Response::from_file(file)
                .with_status_code(StatusCode(if found { 200 } else { 404 }))
                .with_header(header("Content-Type", &content_type))
                .with_header(header("Cache-Control", cache)),
        ),
        Err(_) => request
            .respond(Response::from_string("Page not found").with_status_code(StatusCode(404))),
    };
    if let Err(error) = result {
        eprintln!("Preview connection: {error}");
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpStream,
        sync::Arc,
        thread::JoinHandle,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    struct Preview {
        root: PathBuf,
        server: Arc<Server>,
        task: Option<JoinHandle<()>>,
    }

    impl Preview {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "atlas-preview-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(root.join("folder")).unwrap();
            fs::write(root.join("index.html"), "home").unwrap();
            fs::write(root.join("folder/index.html"), "folder").unwrap();
            fs::write(root.join("404.html"), "missing").unwrap();
            fs::write(root.join("app.wasm"), b"\0asm\x01\0\0\0").unwrap();
            // A sparse file exceeds socket buffers without allocating a large fixture.
            fs::File::create(root.join("large.glb"))
                .unwrap()
                .set_len(128 * 1024 * 1024)
                .unwrap();
            let server = Arc::new(Server::http(("127.0.0.1", 0)).unwrap());
            let serving = server.clone();
            let directory = fs::canonicalize(&root).unwrap();
            let task = std::thread::spawn(move || serve_requests(&serving, &directory, "/atlas/"));
            Self {
                root,
                server,
                task: Some(task),
            }
        }

        fn socket(&self) -> TcpStream {
            let stream = TcpStream::connect(self.server.server_addr().to_ip().unwrap()).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            stream
        }

        fn connect(&self, method: &str, path: &str) -> TcpStream {
            let mut stream = self.socket();
            write!(
                stream,
                "{method} {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            stream
        }

        fn request(&self, method: &str, path: &str) -> String {
            let mut response = String::new();
            self.connect(method, path)
                .read_to_string(&mut response)
                .unwrap();
            response
        }
    }

    impl Drop for Preview {
        fn drop(&mut self) {
            for _ in 0..REQUEST_WORKERS {
                self.server.unblock();
            }
            self.task.take().unwrap().join().unwrap();
            fs::remove_dir_all(&self.root).unwrap();
        }
    }

    fn read_keep_alive_response(stream: &mut TcpStream) -> (String, Vec<u8>) {
        let mut headers = Vec::new();
        while !headers.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            headers.push(byte[0]);
            assert!(headers.len() < 8192);
        }
        let headers = String::from_utf8(headers).unwrap();
        let length = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().unwrap())
            })
            .expect("static preview gives the exact response length");
        assert!(length < 1024);
        let mut body = vec![0; length];
        stream.read_exact(&mut body).unwrap();
        (headers, body)
    }

    #[test]
    fn idle_and_reused_connections_do_not_starve_new_preview_requests() {
        let preview = Preview::new();
        // Browsers may establish speculative sockets before sending headers.
        // Keep these and every completed response connection open throughout.
        let mut speculative: Vec<_> = (0..4).map(|_| preview.socket()).collect();
        let mut clients: Vec<_> = (0..6).map(|_| preview.socket()).collect();
        for stream in &mut clients {
            stream
                .write_all(b"GET /atlas/app.wasm HTTP/1.1\r\nHost: localhost\r\n\r\n")
                .unwrap();
        }
        for stream in &mut clients {
            let (headers, body) = read_keep_alive_response(stream);
            assert!(headers.starts_with("HTTP/1.1 200"));
            assert!(
                headers
                    .to_ascii_lowercase()
                    .contains("content-type: application/wasm\r\n")
            );
            assert_eq!(body, b"\0asm\x01\0\0\0");
        }
        // Reuse those same sockets, rather than allowing a close to free readers.
        for stream in &mut clients {
            stream
                .write_all(b"GET /atlas/folder/ HTTP/1.1\r\nHost: localhost\r\n\r\n")
                .unwrap();
        }
        for stream in &mut clients {
            let (headers, body) = read_keep_alive_response(stream);
            assert!(headers.starts_with("HTTP/1.1 200"));
            assert_eq!(body, b"folder");
        }
        for stream in &mut speculative {
            stream
                .write_all(b"GET /atlas/absent HTTP/1.1\r\nHost: localhost\r\n\r\n")
                .unwrap();
        }
        for stream in &mut speculative {
            let (headers, body) = read_keep_alive_response(stream);
            assert!(headers.starts_with("HTTP/1.1 404"));
            assert_eq!(body, b"missing");
        }
    }

    #[test]
    fn stalled_asset_does_not_block_other_preview_requests() {
        let preview = Preview::new();
        let mut stalled = preview.connect("GET", "/atlas/large.glb");
        // Read only the headers, proving that this response started before the
        // independent request. Leave its large body unread until the test ends.
        let mut headers = Vec::new();
        while !headers.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stalled.read_exact(&mut byte).unwrap();
            headers.push(byte[0]);
            assert!(headers.len() < 8192);
        }
        assert!(headers.starts_with(b"HTTP/1.1 200"));

        let wasm = preview.request("HEAD", "/atlas/app.wasm");
        assert!(wasm.starts_with("HTTP/1.1 200"));
        assert!(
            wasm.to_ascii_lowercase()
                .contains("content-type: application/wasm\r\n")
        );
        assert_eq!(wasm.split_once("\r\n\r\n").unwrap().1, "");
        let missing = preview.request("GET", "/atlas/absent");
        assert!(missing.starts_with("HTTP/1.1 404"));
        assert_eq!(missing.split_once("\r\n\r\n").unwrap().1, "missing");
        assert!(
            preview
                .request("GET", "/atlas/%2e%2e/secret")
                .starts_with("HTTP/1.1 403")
        );
        let redirect = preview.request("GET", "/atlas/folder?lang=ja");
        assert!(redirect.starts_with("HTTP/1.1 301"));
        assert!(
            redirect
                .to_ascii_lowercase()
                .contains("location: /atlas/folder/?lang=ja\r\n")
        );
        assert!(
            preview
                .request("GET", "/elsewhere")
                .starts_with("HTTP/1.1 404")
        );
        drop(stalled);
    }

    #[test]
    fn percent_encoded_paths_cannot_escape_document_root() {
        let root = std::env::temp_dir();
        assert_eq!(resolve(&root, "/%2e%2e/secret").unwrap_err(), 403);
        assert_eq!(resolve(&root, "/bad%2").unwrap_err(), 400);
        assert_eq!(resolve(&root, "/%FF").unwrap_err(), 400);
        assert_eq!(resolve(&root, "/%00").unwrap_err(), 400);
        assert_eq!(
            resolve(&root, "/folder/../index.html").unwrap(),
            root.join("index.html")
        );
    }
}
