use super::background::save_background;
use crate::ui::{icons::icon, locale::use_language};
use yew::prelude::*;
#[derive(Properties, PartialEq)]
pub struct BackgroundPickerProps {
    pub selected: bool,
    pub on_select: Callback<String>,
    pub on_remove: Callback<()>,
    pub on_error: Callback<String>,
}
#[function_component(BackgroundPicker)]
pub fn background_picker(props: &BackgroundPickerProps) -> Html {
    let language = use_language();
    let input = use_node_ref();
    let busy = use_state(|| false);
    let open = {
        let input = input.clone();
        Callback::from(move |_| {
            if let Some(input) = input.cast::<web_sys::HtmlInputElement>() {
                input.click();
            }
        })
    };
    let upload = {
        let busy = busy.clone();
        let selected = props.on_select.clone();
        let error = props.on_error.clone();
        Callback::from(move |event: Event| {
            let input = event.target_unchecked_into::<web_sys::HtmlInputElement>();
            let file = input.files().and_then(|f| f.get(0));
            input.set_value("");
            if let Some(file) = file {
                busy.set(true);
                let busy = busy.clone();
                let selected = selected.clone();
                let error = error.clone();
                wasm_bindgen_futures::spawn_local(async move {
                    match save_background(file).await{Ok(image)=>{let _=web_sys::Url::revoke_object_url(&image.url);selected.emit(image.id)},Err(code)=>error.emit(match code.as_str(){"too-large"=>"Choose an image smaller than 10 MB.","storage"=>"The background could not be saved on this device.",_=>"This image could not be opened. Use JPEG, PNG, WebP, GIF or AVIF."}.into())}
                    busy.set(false);
                });
            }
        })
    };
    let remove = {
        let callback = props.on_remove.clone();
        Callback::from(move |_| callback.emit(()))
    };
    html! {<div class="background-picker"><button class="scene-button" disabled={*busy} onclick={open}>{icon("upload",15)}{language.t(if *busy{"Opening image…"}else if props.selected{"Change background image"}else{"Upload background image"})}</button>{if props.selected{html!{<button class="scene-button" onclick={remove}>{icon("x",15)}{language.t("Remove background image")}</button>}}else{Html::default()}}<input ref={input} type="file" hidden=true accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onchange={upload}/><small>{language.t("Images stay on this device. Maximum 10 MB.")}</small></div>}
}
