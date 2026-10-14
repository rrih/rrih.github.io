use super::{cards::FormSelect, icons::icon, locale::use_language};
use crate::{
    browser,
    core::{
        catalog, forms,
        scene_studio::{MAX_MEMBERS, MAX_SCENES, SavedScene, SceneMember},
    },
};
use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub members: Vec<SceneMember>,
    pub on_change: Callback<Vec<SceneMember>>,
    pub name: String,
    pub on_name_change: Callback<String>,
    pub saved: Vec<SavedScene>,
    pub on_save: Callback<()>,
    pub on_open: Callback<SavedScene>,
    pub on_delete: Callback<String>,
    pub on_download: Callback<()>,
    pub on_import: Callback<web_sys::File>,
    pub storage_failed: bool,
}
#[function_component(SceneEditor)]
pub fn scene_editor(props: &Props) -> Html {
    let language = use_language();
    let selected_key = use_state(|| {
        props
            .members
            .first()
            .map(|m| m.key.clone())
            .unwrap_or_default()
    });
    let adding = use_state(|| false);
    let query = use_state(String::new);
    let visible = use_state(|| 12usize);
    let import_input = use_node_ref();
    let selected = props
        .members
        .iter()
        .find(|m| m.key == *selected_key)
        .or_else(|| props.members.first())
        .cloned();
    let results = if query.trim().is_empty() {
        [25, 6, 1, 7, 133, 151, 39, 143]
            .into_iter()
            .filter_map(catalog::pokemon_by_id)
            .collect::<Vec<_>>()
    } else {
        catalog::filter_pokemon(&query, 0, "", None)
    }
    .into_iter()
    .filter(|p| catalog::models().contains_key(&p.id))
    .collect::<Vec<_>>();
    {
        let adding = adding.clone();
        use_effect_with(*adding, move |open| {
            if *open {
                browser::after_frame(|| browser::focus(".scene-search input"));
            }
            || ()
        });
    }
    let range = |field: &'static str, label: &str, min: f64, max: f64, step: f64| {
        let Some(member) = selected.clone() else {
            return Html::default();
        };
        let value = match field {
            "x" => member.x,
            "z" => member.z,
            "rotation" => member.rotation,
            _ => member.scale,
        };
        let unit = match field {
            "rotation" => "°",
            "scale" => "×",
            _ => "",
        };
        let formatted = format!(
            "{}{unit}",
            language.format(
                value,
                serde_json::json!({"maximumFractionDigits":if field=="scale"{2}else{1}})
            )
        );
        let oninput = {
            let action = props.on_change.clone();
            let members = props.members.clone();
            let key = member.key.clone();
            Callback::from(move |event: InputEvent| {
                let input = event.target_unchecked_into::<web_sys::HtmlInputElement>();
                let value = input.value().parse::<f64>().unwrap_or_default();
                let mut members = members.clone();
                if let Some(member) = members.iter_mut().find(|m| m.key == key) {
                    match field {
                        "x" => member.x = value,
                        "z" => member.z = value,
                        "rotation" => member.rotation = value,
                        _ => member.scale = value,
                    }
                }
                action.emit(members)
            })
        };
        html! {<label class="scene-range" for={format!("scene-{field}")}><span><span>{label}</span><output for={format!("scene-{field}")}><bdi>{formatted.clone()}</bdi></output></span><input id={format!("scene-{field}")} type="range" min={min.to_string()} max={max.to_string()} step={step.to_string()} value={value.to_string()} dir="ltr" aria-label={label.to_owned()} aria-valuetext={formatted} {oninput}/></label>}
    };
    let onsubmit = {
        let action = props.on_save.clone();
        let name = props.name.clone();
        Callback::from(move |event: SubmitEvent| {
            event.prevent_default();
            if !name.trim().is_empty() {
                action.emit(())
            }
        })
    };
    let on_name = {
        let action = props.on_name_change.clone();
        Callback::from(move |event: InputEvent| {
            action.emit(
                event
                    .target_unchecked_into::<web_sys::HtmlInputElement>()
                    .value()
                    .chars()
                    .take(60)
                    .collect(),
            )
        })
    };
    let arrange = {
        let action = props.on_change.clone();
        let members = props.members.clone();
        Callback::from(move |_: MouseEvent| {
            let mut members = members.clone();
            let columns = if members.len() <= 3 { members.len() } else { 2 };
            if columns == 0 {
                return;
            }
            let rows = members.len().div_ceil(columns);
            let count = members.len();
            for (index, member) in members.iter_mut().enumerate() {
                let row = index / columns;
                let row_count = columns.min(count - row * columns);
                member.x = ((index % columns) as f64 - (row_count as f64 - 1.) / 2.) * 3.3;
                member.z = (row as f64 - (rows as f64 - 1.) / 2.) * 3.1;
            }
            action.emit(members)
        })
    };
    html! {<section class="scene-editor" aria-label={language.t("Your scene")}>
      <header class="scene-editor-heading"><div><h2>{language.t("Your scene")}</h2></div><span class="scene-member-count"><span class="sr-only">{language.tv("{count} Pokémon",&[("count",language.number(props.members.len()as f64))])}</span><bdi aria-hidden="true">{format!("{} / {}",language.number(props.members.len()as f64),language.number(MAX_MEMBERS as f64))}</bdi></span></header>
      <form class="scene-name-form" {onsubmit}><label for="scene-name"><span>{language.t("Scene name")}</span><input id="scene-name" value={props.name.clone()} maxlength="120" autocomplete="off" oninput={on_name}/></label><button type="submit" class="scene-button scene-button-primary" disabled={props.name.trim().is_empty()}>{icon("save",15)}<span>{language.t("Save scene")}</span></button></form>
      {if props.storage_failed{html!{<p class="scene-storage-error" role="status">{language.t("This scene could not be saved on this device.")}</p>}}else{html!{<p class="scene-help">{language.t("Changes are saved on this device.")}</p>}}}
      <fieldset class="scene-members" aria-label={language.t("Your scene")}>{for props.members.iter().enumerate().filter_map(|(index,member)|{let entry=catalog::pokemon_by_id(member.species_id)?;let local=language.species(entry);let chosen=selected.as_ref().is_some_and(|s|s.key==member.key);let onclick={let key=member.key.clone();let state=selected_key.clone();Callback::from(move|_|state.set(key.clone()))};Some(html!{<button type="button" key={member.key.clone()} class={classes!("scene-member",chosen.then_some("is-selected"))} aria-pressed={chosen.to_string()} aria-label={format!("{} · {}",language.tv("Edit {name}",&[("name",local.entry.name.clone())]),language.number((index+1)as f64))} {onclick}><span class="scene-member-number" aria-hidden="true">{language.number((index+1)as f64)}</span><img src={catalog::art(member.species_id)} alt="" width="48" height="48" loading="lazy"/><span><bdi lang={local.name_lang}>{local.entry.name}</bdi></span>{if let Some(form)=forms::find_form(member.species_id,member.form_id.as_deref()){html!{<small>{forms::form_label(form,|key|language.t(key))}</small>}}else{Html::default()}}{if member.shiny{icon("sparkles",12)}else{Html::default()}}</button>})})}</fieldset>
      <div class="scene-member-actions"><button type="button" class="scene-button" disabled={props.members.len()>=MAX_MEMBERS} aria-expanded={adding.to_string()} aria-controls="scene-search-panel" onclick={{let adding=adding.clone();Callback::from(move|_|adding.set(!*adding))}}>{icon("plus",15)}<span>{language.t("Add a Pokémon")}</span></button><button type="button" class="scene-button" onclick={arrange} disabled={props.members.is_empty()}>{icon("grid-2x2",15)}<span>{language.t("Arrange automatically")}</span></button></div><p class="scene-help">{language.tv("Up to {count} Pokémon can share a scene.",&[("count",language.number(MAX_MEMBERS as f64))])}</p>
      <div id="scene-search-panel" class="scene-add-panel" hidden={!*adding}><label class="scene-search" for="scene-search">{icon("search",16)}<input id="scene-search" type="search" autocomplete="off" value={(*query).clone()} aria-label={language.t("Search Pokémon to add")} placeholder={language.t("Search Pokémon to add")} onkeydown={{let adding=adding.clone();Callback::from(move|event:KeyboardEvent|{if event.key()=="Escape"{event.prevent_default();event.stop_propagation();adding.set(false);browser::focus(".scene-member-actions button");}})}} oninput={{let query=query.clone();let visible=visible.clone();Callback::from(move|event:InputEvent|{query.set(event.target_unchecked_into::<web_sys::HtmlInputElement>().value());visible.set(12);})}}/></label>
      <div class="scene-search-results">{for results.iter().take(*visible).map(|entry|{let local=language.species(entry);let onclick={let id=entry.id;let members=props.members.clone();let action=props.on_change.clone();let selected_key=selected_key.clone();let adding=adding.clone();let query=query.clone();let visible=visible.clone();Callback::from(move|_|{if members.len()>=MAX_MEMBERS{return}let points=[[-3.2,-3.2],[3.2,3.2],[3.2,-3.2],[-3.2,3.2],[-3.2,0.],[3.2,0.],[0.,-3.2],[0.,3.2],[0.,0.]];let distance=|point:[f64;2]|members.iter().map(|m|(m.x-point[0]).hypot(m.z-point[1])).fold(f64::INFINITY,f64::min);let mut point=points[0];for next in points{if distance(next)>distance(point){point=next;}}if members.is_empty(){point=[0.,0.]};let key=browser::uuid();let mut members=members.clone();members.push(SceneMember{key:key.clone(),species_id:id,form_id:None,shiny:false,x:point[0],z:point[1],rotation:0.,scale:1.});action.emit(members);selected_key.set(key);adding.set(false);query.set(String::new());visible.set(12);browser::after_frame(||browser::focus(".scene-selected-editor input"));})};html!{<button type="button" key={entry.id} class="scene-search-result" disabled={props.members.len()>=MAX_MEMBERS} aria-label={language.tv("Add {name} to scene",&[("name",local.entry.name.clone())])} {onclick}><img src={catalog::art(entry.id)} alt="" width="36" height="36" loading="lazy"/><span><bdi lang={local.name_lang}>{local.entry.name}</bdi><small><bdi>{format!("#{:03}",entry.id)}</bdi></small></span>{icon("plus",13)}</button>}})}</div>
      {if results.is_empty(){html!{<p class="scene-help" role="status">{language.t("No Pokémon found.")}</p>}}else{Html::default()}}{if results.len()>*visible{html!{<button type="button" class="scene-button scene-more" onclick={{let visible=visible.clone();Callback::from(move|_|visible.set(*visible+12))}}>{language.t("Discover more")}</button>}}else{Html::default()}}</div>
      {if let Some(member)=selected.as_ref(){let local=language.species(catalog::pokemon_by_id(member.species_id).unwrap());let remove={let key=member.key.clone();let members=props.members.clone();let action=props.on_change.clone();let selected_key=selected_key.clone();Callback::from(move|_|{if members.len()<=1{return}let index=members.iter().position(|m|m.key==key).unwrap_or(0);selected_key.set(members[(index+1)%members.len()].key.clone());action.emit(members.iter().filter(|m|m.key!=key).cloned().collect());browser::after_frame(||browser::focus(".scene-selected-editor input"));})};let form_change={let member=member.clone();let members=props.members.clone();let action=props.on_change.clone();Callback::from(move|id:String|{let mut members=members.clone();if let Some(selected)=members.iter_mut().find(|m|m.key==member.key){selected.form_id=(!id.is_empty()).then_some(id.clone());selected.shiny=selected.shiny&&forms::model_for(selected.species_id,Some(&id)).is_some_and(|m|m.shiny.is_some());}action.emit(members);})};
      html!{<div class="scene-selected-editor"><div class="scene-selected-heading"><h3><bdi lang={local.name_lang}>{local.entry.name.clone()}</bdi></h3><button type="button" class="scene-icon-button" disabled={props.members.len()<=1} onclick={remove} aria-label={language.tv("Remove {name} from scene",&[("name",local.entry.name)])}>{icon("trash-2",16)}</button></div><FormSelect species_id={member.species_id} value={member.form_id.clone().unwrap_or_default()} on_change={form_change}/><fieldset class="scene-position"><legend>{language.t("Position")}</legend><div class="scene-ranges">{range("x",&language.t("Left / right"),-4.,4.,0.1)}{range("z",&language.t("Near / far"),-4.,4.,0.1)}</div></fieldset><div class="scene-ranges">{range("rotation",&language.t("Direction"),-180.,180.,5.)}{range("scale",&language.t("Size"),0.4,1.6,0.05)}</div>{if forms::model_for(member.species_id,member.form_id.as_deref()).is_some_and(|m|m.shiny.is_some()){let key=member.key.clone();let members=props.members.clone();let action=props.on_change.clone();html!{<button type="button" class={classes!("scene-button","scene-shiny-toggle",member.shiny.then_some("is-selected"))} aria-pressed={member.shiny.to_string()} onclick={Callback::from(move|_|{let mut members=members.clone();if let Some(member)=members.iter_mut().find(|m|m.key==key){member.shiny = !member.shiny;}action.emit(members)})}>{icon("sparkles",15)}<span>{language.t("Shiny appearance")}</span></button>}}else{Html::default()}}</div>}}else{Html::default()}}
      <details class="scene-saved"><summary><span>{language.t("Saved scenes")}</span><bdi>{language.number(props.saved.len()as f64)}</bdi>{icon("chevron-down",16)}</summary>{if props.saved.is_empty(){html!{<p class="scene-help">{language.t("No saved scenes yet.")}</p>}}else{html!{<ul>{for props.saved.iter().map(|scene|{let open={let scene=scene.clone();let action=props.on_open.clone();let selected_key=selected_key.clone();let adding=adding.clone();Callback::from(move|_|{action.emit(scene.clone());selected_key.set(scene.members.first().map(|m|m.key.clone()).unwrap_or_default());adding.set(false);})};let delete={let question=language.tv("Delete scene \"{name}\"?",&[("name",scene.name.clone())]);let id=scene.id.clone();let action=props.on_delete.clone();Callback::from(move|_|{if browser::window().confirm_with_message(&question).unwrap_or(false){action.emit(id.clone())}})};html!{<li key={scene.id.clone()}><button type="button" class="scene-open" aria-label={format!("{}: {}",language.t("Open scene"),scene.name)} onclick={open}>{icon("folder-open",17)}<span><strong><bdi>{scene.name.clone()}</bdi></strong><small>{language.tv("{count} Pokémon",&[("count",language.number(scene.members.len()as f64))])}</small></span></button><button type="button" class="scene-icon-button" aria-label={format!("{}: {}",language.t("Delete scene"),scene.name)} onclick={delete}>{icon("trash-2",16)}</button></li>}})}</ul>}}}<p class="scene-help">{language.tv("You can save up to {count} scenes.",&[("count",language.number(MAX_SCENES as f64))])}</p></details>
      <div class="scene-file-actions"><button type="button" class="scene-button" onclick={{let action=props.on_download.clone();Callback::from(move|_|action.emit(()))}}>{icon("download",15)}<span>{language.t("Download scene")}</span></button><button type="button" class="scene-button" onclick={{let input=import_input.clone();Callback::from(move|_|{if let Some(input)=input.cast::<web_sys::HtmlInputElement>(){input.click();}})}}>{icon("upload",15)}<span>{language.t("Import scene")}</span></button><input ref={import_input} type="file" accept=".json,application/json" hidden=true onchange={{let action=props.on_import.clone();Callback::from(move|event:Event|{let input=event.target_unchecked_into::<web_sys::HtmlInputElement>();let file=input.files().and_then(|files|files.get(0));input.set_value("");if let Some(file)=file{action.emit(file);}})}}/></div>
    </section>}
}
