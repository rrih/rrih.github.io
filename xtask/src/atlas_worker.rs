use crate::{Result, command, copy_file, tool, write};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

pub fn build() -> Result {
    command(
        &tool("cargo"),
        &[
            "build",
            "--locked",
            "--release",
            "--target",
            "wasm32-unknown-unknown",
            "-p",
            "atlas-worker",
        ],
    )?;
    command(
        &tool("wasm-bindgen"),
        &[
            "target/wasm32-unknown-unknown/release/atlas_worker.wasm",
            "--target",
            "no-modules",
            "--out-dir",
            "atlas/worker/pkg",
            "--out-name",
            "atlas_worker",
            "--no-typescript",
            "--remove-name-section",
        ],
    )?;
    let bindings = fs::read("atlas/worker/pkg/atlas_worker.js")?;
    let wasm = fs::read("atlas/worker/pkg/atlas_worker_bg.wasm")?;
    let mut hash = Sha256::new();
    hash.update(&bindings);
    hash.update(&wasm);
    let hash = format!("{:x}", hash.finalize());
    let hash = &hash[..20];
    let bindings_name = format!("worker-{hash}.js");
    let wasm_name = format!("worker-{hash}.wasm");
    let loader = fs::read_to_string("atlas/worker/loader.js")?
        .replace("__BINDINGS__", &bindings_name)
        .replace("__WASM__", &wasm_name);
    let loader_hash = format!("{:x}", Sha256::digest(loader.as_bytes()));
    let loader_name = format!("worker-runtime-{}.js", &loader_hash[..20]);
    copy_file(
        "atlas/worker/pkg/atlas_worker.js",
        Path::new("atlas/dist").join(&bindings_name),
    )?;
    copy_file(
        "atlas/worker/pkg/atlas_worker_bg.wasm",
        Path::new("atlas/dist").join(&wasm_name),
    )?;
    write(Path::new("atlas/dist").join(&loader_name), loader)?;
    write(
        "atlas/worker/pkg/workbox.json",
        serde_json::to_string(&json!({"importScript":loader_name}))?,
    )?;
    Ok(())
}
