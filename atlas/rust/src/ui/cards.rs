use super::{icons::icon_filled, locale::use_language};
use crate::{
    browser,
    core::{
        catalog, forms,
        routes::{self, AtlasPage},
        types::Pokemon,
    },
};
use yew::prelude::*;

pub fn follow(event: &MouseEvent) -> bool {
    if event.button() != 0
        || event.meta_key()
        || event.ctrl_key()
        || event.shift_key()
        || event.alt_key()
    {
        false
    } else {
        event.prevent_default();
        true
    }
}
#[derive(Properties, PartialEq)]
pub struct TypePillProps {
    pub kind: String,
}
#[function_component(TypePill)]
pub fn type_pill(props: &TypePillProps) -> Html {
    let language = use_language();
    let color = catalog::type_color(&props.kind);
    html! {<a href={routes::atlas_path(&AtlasPage::Type{pokemon_type:props.kind.clone()},&language.locale)} class="type-pill" style={format!("color:{color};border-color:{color}40")}><i style={format!("background:{color}")}/>{language.type_name(&props.kind)}</a>}
}
#[derive(Properties, PartialEq)]
pub struct CardProps {
    pub entry: Pokemon,
    pub active: bool,
    pub saved: bool,
    pub on_select: Callback<()>,
    #[prop_or_default]
    pub form_id: Option<String>,
}
#[function_component(PokemonCard)]
pub fn card(props: &CardProps) -> Html {
    let language = use_language();
    let species = language.species(&props.entry);
    let onclick = {
        let action = props.on_select.clone();
        Callback::from(move |event: MouseEvent| {
            if follow(&event) {
                action.emit(())
            }
        })
    };
    html! {<a href={routes::ui_href(&AtlasPage::Pokemon{id:props.entry.id,form_id:props.form_id.clone()},&language.locale)} class={classes!("pokemon-card",props.active.then_some("selected"))} {onclick} aria-current={props.active.then_some("true")} aria-label={language.tv("View {name}",&[("name",species.entry.name.clone())])}><span class="card-number">{format!("{:03}",props.entry.id)}</span>{if props.saved{icon_filled("heart",12,"card-heart")}else{Html::default()}}<img src={catalog::art(props.entry.id)} alt="" loading="lazy" width="90" height="90" onerror={Callback::from(|event:Event|{use wasm_bindgen::JsCast;if let Some(element)=event.target().and_then(|e|e.dyn_into::<web_sys::Element>().ok()){let _=element.set_attribute("style","visibility:hidden");}})}/><span class="card-name"><bdi lang={species.name_lang}>{species.entry.name}</bdi></span><span class="card-types">{for props.entry.types.iter().map(|kind|html!{<i key={kind.clone()} style={format!("background:{}",catalog::type_color(kind))}/>})}</span></a>}
}
#[derive(Properties, PartialEq)]
pub struct FormSelectProps {
    pub species_id: u16,
    pub value: String,
    pub on_change: Callback<String>,
    #[prop_or_default]
    pub id: Option<String>,
}
#[function_component(FormSelect)]
pub fn form_select(props: &FormSelectProps) -> Html {
    let language = use_language();
    let options = forms::forms_for(props.species_id);
    if options.is_empty() {
        return Html::default();
    }
    let onchange = {
        let action = props.on_change.clone();
        Callback::from(move |event: Event| {
            use wasm_bindgen::JsCast;
            if let Some(input) = event
                .target()
                .and_then(|v| v.dyn_into::<web_sys::HtmlSelectElement>().ok())
            {
                action.emit(input.value())
            }
        })
    };
    html! {<label class="form-select"><span>{language.t("Form")}</span><select id={props.id.clone()} aria-label={language.t("Form")} value={props.value.clone()} {onchange}><option value="" selected={props.value.is_empty()}>{language.t("Standard form")}</option>{for options.iter().map(|form|html!{<option value={form.id.clone()} selected={props.value==form.id}>{forms::form_label(form,|key|language.t(key))}</option>})}</select></label>}
}
pub fn focus_collection() {
    browser::after_frame(|| browser::focus(".search-box input"));
}
