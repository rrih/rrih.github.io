use super::*;
impl App {
    pub(super) fn render(&self, ctx: &Context<Self>) -> Html {
        let l = &self.language;
        let filtered = self.filter();
        let details = self.details();
        let displayed = forms::form_pokemon(self.selected(), self.form());
        let together = self.together();
        let page = self.page();
        let seo = self.seo();
        let inert = self.mobile_collection && browser::media("(max-width: 700px)");
        let entries = if together {
            self.studio
                .draft
                .as_ref()
                .unwrap()
                .members
                .iter()
                .map(|member| {
                    let model = forms::model_for(member.species_id, member.form_id.as_deref());
                    ModelRequest {
                        key: member.key.clone(),
                        species_id: member.species_id,
                        url: model.map(|m| {
                            if member.shiny {
                                m.shiny.clone().unwrap_or_else(|| m.url.clone())
                            } else {
                                m.url.clone()
                            }
                        }),
                    }
                })
                .collect()
        } else {
            vec![ModelRequest {
                key: "solo".into(),
                species_id: self.selected,
                url: self.model().map(|m| {
                    if self.settings.shiny {
                        m.shiny.clone().unwrap_or_else(|| m.url.clone())
                    } else {
                        m.url.clone()
                    }
                }),
            }]
        };
        let label = l.tv(
            "{name} interactive 3D studio",
            &[(
                "name",
                if together {
                    self.studio
                        .draft
                        .as_ref()
                        .unwrap()
                        .members
                        .iter()
                        .filter_map(|m| catalog::pokemon_by_id(m.species_id))
                        .map(|p| l.species(p).entry.name)
                        .collect::<Vec<_>>()
                        .join(", ")
                } else {
                    details.entry.name.clone()
                },
            )],
        );
        let mut viewer_settings = self.settings.clone();
        if self.background_failed && viewer_settings.habitat == "custom" {
            viewer_settings.habitat = "studio".into();
        }
        html! {<ContextProvider<Language> context={self.language.clone()}><div class="app-shell" data-locale={l.locale.clone()} data-catalog-state={l.catalog_status.clone()}>
         <button class="skip-link" onclick={Callback::from(|event:MouseEvent|{event.prevent_default();browser::focus("#main");})}>{l.t("Skip to viewer")}</button>
         {self.header(ctx)}
         if self.offline{<div class="offline-notice" role="status">{l.t("You’re offline. Recently viewed Pokémon may still be available.")}</div>}
         if self.need_refresh{<div class="offline-notice">{l.t("A fresh version of Atlas is ready.")}<button onclick={Self::click(ctx,Msg::ApplyUpdate)}>{l.t("Update now")}</button></div>}
         <div class="workspace">{self.collection(ctx,&filtered)}<main id="main" tabindex="-1" class="main-panel" inert={inert}>
          <nav class="atlas-breadcrumbs" aria-label={seo::seo_words(&l.locale).catalog.clone()}>{for seo.breadcrumbs.iter().enumerate().map(|(index,crumb)|html!{<span key={crumb.href.clone()}>if index>0{<span aria-hidden="true">{" / "}</span>}<a href={crumb.href.clone()} aria-current={(index+1==seo.breadcrumbs.len()).then_some("page")}>{crumb.name.clone()}</a></span>})}</nav>
          if matches!(page,AtlasPage::Home){<h1 class="atlas-home-title">{seo::seo_words(&l.locale).home.clone()}</h1>}
          <div class="mobile-toolbar"><button onclick={Self::click(ctx,Msg::Toggle("browse"))}>{icon("search",16)}{l.tv("Browse {count} Pokémon",&[("count",l.number(catalog::pokemon().len()as f64))])}</button><button aria-label={l.t("Pokémon details and studio settings")} onclick={{let link=ctx.link().clone();Callback::from(move|_|{link.send_message(Msg::Text("tab","overview".into()));if let Some(element)=browser::document().get_element_by_id("overview"){element.scroll_into_view();}})}}>{l.t("Overview")}</button></div>
          <div class="specimen-heading"><div><div class="eyebrow">{if together{html!{l.t("Together")}}else{html!{<><span class="catalog-number">{format!("# {:04}",self.selected)}</span><span class="tiny-dot"/>{l.generation(self.selected().generation)}</>}}}</div>
           {if matches!(page,AtlasPage::Home){html!{<h2>{if together{html!{l.t("Your scene")}}else{html!{<bdi lang={details.name_lang.clone()}>{details.entry.name.clone()}</bdi>}}}</h2>}}else{html!{<h1><bdi lang={details.name_lang.clone()}>{details.entry.name.clone()}</bdi></h1>}}}
           <div class="type-row">{if together{html!{<span class="genus">{l.tv("{count} Pokémon",&[("count",l.number(self.studio.draft.as_ref().unwrap().members.len()as f64))])}</span>}}else{html!{<>{for displayed.types.iter().map(|kind|html!{<TypePill key={kind.clone()} kind={kind.clone()}/>})}<span class="genus" lang={details.genus_lang.clone()} dir="auto">{details.entry.genus.clone()}</span></>}}}</div></div>
           if !together{<button class={classes!("save-button",self.favorites.contains(&self.selected).then_some("is-saved"))} aria-label={l.tv(if self.favorites.contains(&self.selected){"Remove {name} from collection"}else{"Save {name}"},&[("name",details.entry.name.clone())])} aria-pressed={self.favorites.contains(&self.selected).to_string()} onclick={Self::click(ctx,Msg::Favorite)}>{if self.favorites.contains(&self.selected){icon_filled("heart",20,"")}else{icon("heart",20)}}<span>{l.t(if self.favorites.contains(&self.selected){"Saved"}else{"Save"})}</span></button>}
          </div>
          if !together{<FormSelect species_id={self.selected} value={self.form_id.clone()} on_change={ctx.link().callback(Msg::Form)}/>}
          <fieldset class="scene-mode" aria-label={l.t("Your scene")}><button aria-pressed={(!together).to_string()} onclick={Self::click(ctx,Msg::Solo)}>{l.t("Solo view")}</button><button aria-pressed={together.to_string()} onclick={Self::click(ctx,Msg::Together)}>{l.t("Together")}</button></fieldset>
          <section id="viewer" class={classes!("viewer-stage",self.settings.habitat.clone(),together.then_some("together"),self.focus.then_some("focus-view"))} aria-label={if together{l.t("Your scene")}else{label.clone()}}>
           if !together&&self.loading{<img class="model-loading-preview" src={previews::preview_image(self.selected,self.form().map(|f|f.id.as_str()))} alt={details.entry.name.clone()} width="480" height="480" fetchpriority="high"/>}
           <div class="stage-watermark" aria-hidden="true">{if together{String::new()}else{format!("{:03}",self.selected)}}</div>
           <div class="stage-top"><span class="live-label"><span class={classes!("live-dot",self.loading.then_some("loading"))}/>{l.t(if self.loading{"Opening model"}else if !self.error.is_empty(){"Preview unavailable"}else{"LIVE VIEW"})}</span><button class="stage-button" aria-label={l.t(if self.focus{"Exit focused view"}else{"Expand viewer"})} onclick={Self::click(ctx,Msg::Toggle("focus"))}>{icon(if self.focus{"x"}else{"expand"},17)}</button></div>
           <Viewer key={self.reload} {label} slug={displayed.slug.clone()} {entries} settings={viewer_settings} members={if together{self.studio.draft.as_ref().map(|s|s.members.clone())}else{None}} background_url={self.background_url.clone()} handle={self.handle.clone()} on_load={ctx.link().callback(Msg::Loaded)} on_error={ctx.link().callback(Msg::Error)} on_loading={ctx.link().callback(Msg::Loading)} on_camera_change={ctx.link().callback(Msg::Camera)} on_background_error={ctx.link().callback(|_|Msg::BackgroundFailed)}/>
           if self.loading{<div class="loader">{icon_class("loader-circle",28,"spin")}<span>{l.t("Opening model")}</span></div>}
           if !self.error.is_empty(){<div class="viewer-error">{icon("orbit",34)}<p>{l.t(&self.error)}</p><button class="primary-button" onclick={Self::click(ctx,Msg::Retry)}>{l.t("Try again")}{icon("rotate-ccw",15)}</button></div>}
           <div class="view-tools"><button aria-label={l.t("Zoom in")} onclick={Self::click(ctx,Msg::Zoom(1.))}>{icon("zoom-in",18)}</button><button aria-label={l.t("Zoom out")} onclick={Self::click(ctx,Msg::Zoom(-1.))}>{icon("zoom-out",18)}</button><span/><button aria-label={l.t("Reset camera")} onclick={Self::click(ctx,Msg::View("reset".into()))}>{icon("rotate-ccw",17)}</button><button aria-label={l.t("Save studio image")} disabled={self.loading||!self.error.is_empty()} onclick={Self::click(ctx,Msg::Capture)}>{icon("arrow-down-to-line",17)}</button></div>
           <fieldset class="angle-controls" aria-label={l.t("Camera angles")}>{for["front","side","back","top"].into_iter().map(|angle|html!{<button onclick={Self::click(ctx,Msg::View(angle.into()))}>{l.t(angle)}</button>})}</fieldset><div class="stage-hint">{icon("orbit",13)}{l.t("Drag to orbit")}<span>{"·"}</span>{l.t("Scroll to zoom")}</div>
          </section>{self.playback(ctx)}
          <section class="environment-section" aria-labelledby="environment-title"><div class="section-label"><h2 id="environment-title">{l.t("Environment")}</h2></div><div class="environments">{for HABITATS.iter().filter(|key|**key!="custom"||self.settings.background_id.is_some()).map(|key|html!{<button class={classes!("environment-card",(*key).to_owned(),(self.settings.habitat==*key).then_some("active"))} aria-pressed={(self.settings.habitat==*key).to_string()} onclick={Self::click(ctx,Msg::Setting("habitat",(*key).into()))}><span class="environment-art" aria-hidden="true"/><strong>{l.t(habitat_name(key))}</strong>if self.settings.habitat==*key{{icon_class("check",14,"scene-check")}}</button>})}</div>
           if self.background_failed&&self.settings.habitat=="custom"{<p class="catalog-notice" role="status">{l.t("The background could not be opened.")}<button class="text-button" onclick={Self::click(ctx,Msg::RetryBackground)}>{l.t("Try again")}</button></p>}
           <crate::platform::background::BackgroundPicker selected={self.settings.background_id.is_some()} on_select={ctx.link().callback(Msg::Background)} on_remove={ctx.link().callback(|_|Msg::RemoveBackground)} on_error={ctx.link().callback(Msg::Notice)}/>
          </section>
          if together{if let Some(scene)=self.studio.draft.as_ref(){<SceneEditor members={scene.members.clone()} on_change={ctx.link().callback(Msg::Members)} name={scene.name.clone()} on_name_change={ctx.link().callback(Msg::SceneName)} saved={self.studio.saved.clone()} on_save={ctx.link().callback(|_|Msg::Save)} on_open={ctx.link().callback(Msg::Open)} on_delete={ctx.link().callback(Msg::Delete)} on_download={ctx.link().callback(|_|Msg::Download)} on_import={ctx.link().callback(Msg::Import)} storage_failed={self.storage_failed}/>}}
          <div class="specimen-navigation">{self.neighbor_link(ctx,-1)}<span>{filtered.iter().position(|p|p.id==self.selected).map(|i|format!("{:03}",i+1)).unwrap_or_else(||"—".into())}<i>{"/"}</i>{l.number(filtered.len()as f64)}</span>{self.neighbor_link(ctx,1)}</div>
         </main>{self.detail(ctx,&details,&displayed,inert)}</div>{self.footer(ctx)}
         if !self.notice.is_empty(){<div class="toast" role="status">{icon("check",16)}{l.t(&self.notice)}</div>}
         {self.dialog_view(ctx)}
        </div></ContextProvider<Language>>}
    }
    fn header(&self, ctx: &Context<Self>) -> Html {
        let l = &self.language;
        html! {<header class="header"><a class="brand" href={routes::ui_href(&AtlasPage::Home,&l.locale)} aria-label={l.t("Pokémon Atlas home")}><img src={routes::asset_path("/icon.svg")} alt="" width="38" height="38"/><span>{"pokémon"}<span class="brand-light">{"atlas"}</span><sup>{"3D"}</sup></span></a><nav aria-label={l.t("Main navigation")}><a class={if self.saved_only{""}else{"nav-active"}} href={routes::atlas_path(&AtlasPage::Catalog{page:None},&l.locale)}>{l.t("Explore")}</a><button class={if self.saved_only{"nav-active"}else{""}} onclick={Self::click(ctx,Msg::Toggle("collection"))}>{l.t("Collection")}{" "}<span class="count">{l.number(self.favorites.len()as f64)}</span></button></nav><div class="header-actions"><button class="language-button" aria-label={l.t("Choose your language")} title={l.name(&l.locale)} onclick={Self::click(ctx,Msg::Dialog(Some("language".into())))}>{icon("languages",18)}<bdi>{crate::core::case::upper(&l.locale)}</bdi></button><button class="icon-button" aria-label={l.t("How to explore")} onclick={Self::click(ctx,Msg::Dialog(Some("help".into())))}>{icon("circle-help",19)}</button><button class="install-button" onclick={Self::click(ctx,Msg::Install)}>{icon("arrow-down-to-line",16)}<span>{l.t("Get the app")}</span>{icon("arrow-up-right",15)}</button></div></header>}
    }
    fn collection(&self, ctx: &Context<Self>, filtered: &[&Pokemon]) -> Html {
        let l = &self.language;
        html! {<aside class={classes!("collection-panel",self.mobile_collection.then_some("mobile-open"))} aria-label={l.t("Pokémon collection")}><div class="collection-heading"><div><h2>{l.t("Collection")}</h2></div><button class="icon-button close-collection" aria-label={l.t("Close collection")} onclick={Self::click(ctx,Msg::Toggle("mobile"))}>{icon("x",20)}</button></div><label class="search-box">{icon("search",17)}<input type="search" placeholder={l.t("Name or number…")} aria-label={l.t("Search Pokémon by name or number")} value={self.query.clone()} oninput={Self::input(ctx,"query")}/><kbd>{"/"}</kbd></label><div class="filter-row"><label><span class="sr-only">{l.t("Generation")}</span><select aria-label={l.t("Generation")} value={self.generation.to_string()} onchange={Self::select(ctx,"generation")}>{for(0..10).map(|i|html!{<option value={i.to_string()} selected={self.generation==i}>{l.generation(i)}</option>})}</select>{icon("chevron-down",13)}</label><label><span class="sr-only">{l.t("Type")}</span><select aria-label={l.t("Type")} value={self.pokemon_type.clone()} onchange={Self::select(ctx,"type")}><option value="" selected={self.pokemon_type.is_empty()}>{l.t("All types")}</option>{for routes::POKEMON_TYPES.iter().map(|kind|html!{<option value={(*kind).to_owned()} selected={self.pokemon_type==*kind}>{l.type_name(kind)}</option>})}</select>{icon("chevron-down",13)}</label></div><label class="form-filter"><span class="sr-only">{l.t("Forms")}</span><select aria-label={l.t("Forms")} value={self.form_kind.clone()} onchange={Self::select(ctx,"forms")}><option value="" selected={self.form_kind.is_empty()}>{l.t("All Pokémon")}</option><option value="mega" selected={self.form_kind=="mega"}>{l.t("Mega Evolution")}</option><option value="regional" selected={self.form_kind=="regional"}>{l.t("Regional forms")}</option></select></label><div class="result-count"><span>{l.tv("{count} Pokémon",&[("count",l.number(filtered.len()as f64))])}</span>if !self.query.is_empty()||!self.pokemon_type.is_empty()||!self.form_kind.is_empty()||self.generation!=0{<button onclick={Self::click(ctx,Msg::Clear)}>{l.t("Reset filters")}</button>}{icon("layers-3",14)}</div><div class="collection-scroll">{if filtered.is_empty(){html!{<div class="empty-state">{icon("compass",30)}<h3>{l.t("No Pokémon found.")}</h3><p>{l.t(if self.saved_only{"Tap the heart beside a Pokémon to keep it here."}else{"Try another name, number, generation, or type."})}</p><button class="text-button" onclick={Self::click(ctx,Msg::Clear)}>{l.t("Explore all Pokémon")}{icon("arrow-right",15)}</button></div>}}else{html!{<><div class="pokemon-grid">{for filtered.iter().take(self.limit).map(|entry|{let id=entry.id;html!{<PokemonCard key={id} entry={(*entry).clone()} active={id==self.selected} saved={self.favorites.contains(&id)} on_select={ctx.link().callback(move|_|Msg::Choose(id))} form_id={self.form_choice(entry).map(|f|f.id.clone())}/>}})}</div>if self.limit<filtered.len(){<button class="load-more" onclick={Self::click(ctx,Msg::More)}>{l.t("Discover more")}{icon("arrow-down-to-line",15)}</button>}</>}}}</div></aside>}
    }
    fn playback(&self, ctx: &Context<Self>) -> Html {
        let l = &self.language;
        let unavailable = self.loading || !self.error.is_empty();
        let title = if !self.error.is_empty() {
            "Motion unavailable"
        } else if self.loading {
            "Opening model"
        } else if !self.settings.playing {
            "Play animation"
        } else if !self.animations.is_empty() {
            "In motion"
        } else {
            "Gentle motion"
        };
        let caption = if !self.error.is_empty() {
            "Load a 3D model to play"
        } else if self.loading {
            "Preparing your view"
        } else if !self.animations.is_empty() {
            "Character animation"
        } else {
            "Subtle display movement"
        };
        html! {<div class="playback-bar"><div class="playback-main"><button class="play-button" aria-label={l.t(if self.settings.playing{"Pause animation"}else{"Play animation"})} aria-pressed={self.settings.playing.to_string()} disabled={unavailable} onclick={Self::click(ctx,Msg::Toggle("playing"))}>{icon(if self.settings.playing{"pause"}else{"play"},17)}</button><div><span class="control-heading">{l.t(title)}</span><span class="control-caption">{l.t(caption)}</span></div></div><div class="playback-divider"/><label class="speed-control"><span>{l.t("Speed")}</span><input type="range" aria-label={l.t("Animation speed")} disabled={unavailable} min="0.25" max="2" step="0.25" value={self.settings.speed.to_string()} oninput={Self::setting(ctx,"speed")}/><output>{format!("{}×",l.format(self.settings.speed,serde_json::json!({"maximumFractionDigits":2})))}</output></label><button class={classes!("auto-orbit",self.settings.rotate.then_some("active"))} aria-pressed={self.settings.rotate.to_string()} disabled={unavailable} onclick={Self::click(ctx,Msg::Toggle("rotate"))}>{icon("rotate-ccw",15)}<span>{l.t("Auto orbit")}</span><i/></button></div>}
    }
    fn neighbor_link(&self, ctx: &Context<Self>, direction: i32) -> Html {
        let l = &self.language;
        let onclick = ctx.link().batch_callback(move |event: MouseEvent| {
            cards::follow(&event).then_some(Msg::Move(direction))
        });
        html! {<a href={routes::ui_href(&AtlasPage::Pokemon{id:self.neighbor(direction),form_id:None},&l.locale)} {onclick}>if direction<0{{icon("arrow-left",16)}}{l.t(if direction<0{"Previous"}else{"Next"})}if direction>0{{icon("arrow-right",16)}}</a>}
    }
}
impl App {
    fn detail(
        &self,
        ctx: &Context<Self>,
        details: &Species,
        displayed: &Pokemon,
        inert: bool,
    ) -> Html {
        let l = &self.language;
        let active_form = self.form();
        let evolution: Vec<_> = catalog::pokemon()
            .iter()
            .filter(|p| {
                p.evolves_from == Some(self.selected) || Some(p.id) == self.selected().evolves_from
            })
            .collect();
        html! {<aside id="overview" class="detail-panel" aria-label={l.t("Pokémon details and studio settings")} inert={inert}><div class="detail-tabs"><button class={if self.tab=="overview"{"active"}else{""}} onclick={Self::click(ctx,Msg::Text("tab","overview".into()))}>{l.t("Overview")}</button><button class={if self.tab=="studio"{"active"}else{""}} onclick={Self::click(ctx,Msg::Text("tab","studio".into()))}>{icon("sliders-horizontal",14)}{l.t("Studio")}</button></div>
         {if self.tab=="overview"{html!{<div class="detail-content">
          if l.catalog_status=="loading"{<p class="catalog-notice" role="status">{l.t("Loading translated entries…")}</p>}
          if l.catalog_status=="failed"{<div class="catalog-notice" role="status"><p>{l.t(if self.offline{"Translated entries are unavailable offline. English entries are ready to explore."}else{"Translated entries could not be loaded. English entries are ready to explore."})}</p><button class="text-button" onclick={Self::click(ctx,Msg::Language(l.locale.clone(),false))}>{l.t("Retry translations")}</button></div>}
          if l.locale!="en"&&details.description_lang=="en"{<span class="entry-language" title={l.t("This entry is available in English.")}>{l.t("English entry")}</span>}
          if active_form.is_some(){<p class="entry-source">{format!("{} · {}",l.species(self.selected()).entry.name,l.t("Standard form"))}</p>}
          <img class="species-reference" src={previews::preview_image(self.selected,active_form.map(|f|f.id.as_str()))} alt={details.entry.name.clone()} width="120" height="120" loading="lazy"/><p class="description" lang={details.description_lang.clone()} dir="auto">{details.entry.description.clone()}</p>
          if let Some(url)=details.entry.source_url.as_ref(){<p class="entry-source"><a href={url.clone()} target="_blank" rel="noreferrer">{format!("{}: {}",l.t("Source"),details.entry.source_label.as_deref().unwrap_or("PokéAPI"))}</a>if let Some(date)=details.entry.verified_at.as_ref(){<time datetime={date.clone()}>{format!(" · {date}")}</time>}</p>}
          if !forms::forms_for(self.selected).is_empty(){<details class="available-forms"><summary>{l.t("Form")}</summary><ul><li><a href={routes::ui_href(&AtlasPage::Pokemon{id:self.selected,form_id:None},&l.locale)} onclick={ctx.link().batch_callback(|event:MouseEvent|cards::follow(&event).then_some(Msg::Form(String::new())))}>{l.t("Standard form")}</a></li>{for forms::forms_for(self.selected).iter().map(|form|{let id=form.id.clone();html!{<li key={form.id.clone()}><a href={routes::ui_href(&AtlasPage::Pokemon{id:self.selected,form_id:Some(id.clone())},&l.locale)} onclick={ctx.link().batch_callback(move|event:MouseEvent|cards::follow(&event).then(||Msg::Form(id.clone())))}>{form.names.get(&l.locale).unwrap_or(&form.name).clone()}</a>if form.model.shiny.is_some(){<small>{format!(" · {}",l.t("Shiny appearance"))}</small>}</li>}})}</ul></details>}
          <div class="measurements"><div><span>{l.t("HEIGHT")}</span><strong>{l.number(displayed.height)}<small>{"m"}</small></strong></div><div><span>{l.t("WEIGHT")}</span><strong>{l.number(displayed.weight)}<small>{"kg"}</small></strong></div></div>
          <section class="stats"><div class="section-label"><h3>{l.t("Base stats")}</h3><span>{l.tv("TOTAL {number}",&[("number",l.number(displayed.stats.iter().map(|n|*n as u32).sum::<u32>()as f64))])}</span></div>{for["HP","Attack","Defense","Sp. Atk","Sp. Def","Speed stat"].iter().enumerate().map(|(index,name)|html!{<div class="stat-row" key={index}><span>{l.t(name)}</span><div class="stat-track"><i style={format!("width:{}%",displayed.stats[index]as f64/255.*100.)}/></div><strong>{l.number(displayed.stats[index]as f64)}</strong></div>})}</section>
          if !evolution.is_empty(){<section class="evolution-section"><div class="section-label"><h3>{l.t("Connected by evolution")}</h3></div>{for evolution.iter().map(|entry|{let id=entry.id;let local=l.species(entry);html!{<a href={routes::ui_href(&AtlasPage::Pokemon{id,form_id:None},&l.locale)} key={id} class="evolution-card" onclick={ctx.link().batch_callback(move|event:MouseEvent|cards::follow(&event).then_some(Msg::Choose(id)))}><img src={catalog::art(id)} alt="" width="48" height="48" loading="lazy"/><span><small>{l.t(if Some(id)==self.selected().evolves_from{"EVOLVES FROM"}else{"EVOLVES INTO"})}</small><strong><bdi lang={local.name_lang}>{local.entry.name}</bdi></strong></span>{icon("arrow-up-right",16)}</a>}})}</section>}
         </div>}}else{html!{<div class="detail-content studio-settings"><label class="setting"><span>{l.t("Lighting")}<output>{l.format(self.settings.light,serde_json::json!({"style":"percent","maximumFractionDigits":0}))}</output></span><input aria-label={l.t("Lighting")} type="range" min="0.5" max="1.8" step="0.1" value={self.settings.light.to_string()} oninput={Self::setting(ctx,"light")}/></label><label class="setting"><span>{l.t("Render quality")}</span><select aria-label={l.t("Render quality")} value={self.settings.quality.clone()} onchange={ctx.link().callback(|event:Event|Msg::Setting("quality",event.target_unchecked_into::<web_sys::HtmlSelectElement>().value()))}><option value="high" selected={self.settings.quality=="high"}>{l.t("High detail")}</option><option value="standard" selected={self.settings.quality=="standard"}>{l.t("Battery friendly")}</option></select></label>
          if !self.animations.is_empty()&&!self.loading&&self.error.is_empty(){<label class="setting"><span>{l.t("Animation")}</span><select aria-label={l.t("Animation")} value={self.settings.animation.to_string()} onchange={ctx.link().callback(|event:Event|Msg::Setting("animation",event.target_unchecked_into::<web_sys::HtmlSelectElement>().value()))}>{for self.animations.iter().enumerate().map(|(i,name)|html!{<option key={name.clone()} value={i.to_string()} selected={self.settings.animation as usize==i}>{l.tv("Motion {number}",&[("number",l.number((i+1)as f64))])}</option>})}</select></label>}
          if self.animations.is_empty()&&!self.loading&&self.error.is_empty(){<p class="setting-note">{l.t("This model has no recorded character animation. Gentle motion adds a subtle display movement.")}</p>}
          <button class={classes!("toggle-setting",self.settings.wireframe.then_some("on"))} aria-pressed={self.settings.wireframe.to_string()} onclick={Self::click(ctx,Msg::Toggle("wireframe"))}><span>{icon("layers-3",17)}{l.t("Explore the geometry")}</span><i/></button>
          if !self.together(){<button class={classes!("toggle-setting",self.settings.shiny.then_some("on"))} aria-pressed={self.settings.shiny.to_string()} disabled={!self.model().is_some_and(|m|m.shiny.is_some())} onclick={Self::click(ctx,Msg::Toggle("shiny"))}><span>{icon("sparkles",17)}{l.t("Shiny appearance")}</span><i/></button>}
          if !self.together()&&!self.model().is_some_and(|m|m.shiny.is_some()){<p class="setting-note">{l.t("A shiny model isn’t available for this Pokémon.")}</p>}
          <button class="reset-settings" onclick={Self::click(ctx,Msg::Toggle("reset"))}>{icon("rotate-ccw",15)}{l.t("Reset studio")}</button>
         </div>}}}
         <div class="detail-bottom"><button class="share-button" onclick={Self::click(ctx,Msg::Share)}>{icon("share-2",15)}{l.t("Share link")}{icon("arrow-up-right",15)}</button><button class="about-link" onclick={Self::click(ctx,Msg::Dialog(Some("about".into())))}>{l.t("About Atlas & credits")}</button></div>
        </aside>}
    }
    fn footer(&self, ctx: &Context<Self>) -> Html {
        let l = &self.language;
        html! {<><crate::platform::advertising::AdPlacement locale={l.locale.clone()} label={l.t("Advertisement")}/><footer class="footer"><a href={routes::atlas_path(&AtlasPage::Catalog{page:None},&l.locale)}>{l.t("Pokémon collection")}</a><a href={routes::atlas_path(&AtlasPage::Forms{form_kind:None},&l.locale)}>{l.t("Form")}</a><a href={routes::atlas_path(&AtlasPage::Help,&l.locale)}>{l.t("How to explore")}</a><a href={routes::atlas_path(&AtlasPage::About,&l.locale)}>{l.t("Contact")}</a><span>{l.t("An independent Pokémon fan experience.")}</span><a href={self.legal("terms")}>{l.t("Terms of use")}</a><a href={self.legal("privacy")}>{l.t("Privacy policy")}</a><button onclick={Self::click(ctx,Msg::Dialog(Some("about".into())))}>{l.t("Credits")}{icon("arrow-up-right",12)}</button><crate::platform::advertising::AdChoices locale={l.locale.clone()}/></footer><crate::platform::privacy::Privacy page_id={self.selected} form_id={self.form_id.clone()} locale={l.locale.clone()}/></>}
    }
    fn legal(&self, page: &str) -> String {
        format!(
            "/atlas/legal/{}/{page}.html",
            if self.language.locale == "ja" {
                "ja"
            } else {
                "en"
            }
        )
    }
    fn dialog_view(&self, ctx: &Context<Self>) -> Html {
        let l = &self.language;
        let kind = self.dialog.as_deref();
        let title = match kind {
            Some("language") => "Choose your language",
            Some("help") => "How to explore",
            Some("install") => "Get the app",
            _ => "About Atlas & credits",
        };
        html! {<dialog ref={self.modal.clone()} aria-label={l.t(title)} class="dialog" oncancel={ctx.link().callback(|_|Msg::Dialog(None))} onclose={ctx.link().callback(|_|Msg::Dialog(None))}><button class="dialog-close icon-button" aria-label={l.t("Close dialog")} onclick={Self::click(ctx,Msg::Dialog(None))}>{icon("x",21)}</button>
         {match kind{Some("language")=>{let options:Vec<_>=locales::LOCALES.iter().filter(|(code,native,english)|locales::normalize_search(&format!("{code} {native} {english} {}",l.name(code))).contains(&locales::normalize_search(&self.language_query))).collect();html!{<div class="language-dialog"><span class="eyebrow">{l.t("Language")}</span><h2>{l.t(title)}</h2><label class="search-box">{icon("search",17)}<input type="search" aria-label={l.t("Search languages")} placeholder={l.t("Search languages")} value={self.language_query.clone()} oninput={Self::input(ctx,"language-query")}/></label><div class="language-options">{for options.iter().map(|(code,native,_)|{let code=(*code).to_owned();let busy=self.language_status=="loading";let next=code.clone();let onclick=ctx.link().batch_callback(move|event:MouseEvent|{if cards::follow(&event)&&!busy{Some(Msg::Language(next.clone(),true))}else{None}});html!{<a href={routes::ui_href(&self.page(),&code)} key={code.clone()} data-language={code.clone()} class={classes!("language-choice",(code==l.locale).then_some("selected"))} aria-current={(code==l.locale).then_some("true")} aria-disabled={busy.to_string()} {onclick}><span><bdi lang={code.clone()}>{*native}</bdi><small>{l.name(&code)}</small></span>if code==l.locale{{icon("check",18)}}</a>}})}if options.is_empty(){<p role="status">{l.t("No languages found.")}</p>}</div>if self.language_status=="loading"{<p role="status">{l.t("Loading language…")}</p>}if self.language_status=="failed"{<p role="status">{l.t("The language could not be loaded. Try again.")}<button onclick={Self::click(ctx,Msg::RetryLanguage)}>{l.t("Retry translations")}</button></p>}if browser::stored("atlas-language").as_deref()==Some(&l.locale){<p class="setting-note">{l.t("Your language is saved on this device.")}</p>}</div>}},
          Some("help")=>html!{<><h2>{l.t(title)}</h2><p><a href={routes::atlas_path(&AtlasPage::Help,&l.locale)}>{seo::seo_words(&l.locale).help.clone()}{icon("arrow-up-right",14)}</a></p><div class="guide-list">{for[("orbit","Drag to rotate, scroll or pinch to zoom. Use Front, Side, Back, and Top for a new perspective."),("play","Play or pause motion, change its speed, and turn on auto orbit."),("sun","Choose a scene, adjust the light in Studio, and save an image."),("heart","Tap Save to add a Pokémon to your collection on this device.")].iter().map(|(name,text)|html!{<div>{icon(name,24)}<span>{l.t(text)}</span></div>})}</div><p class="shortcut-note">{l.t("Keyboard: ← / → previous / next · Space play / pause · / search · Esc close")}</p></>},
          Some("about")=>html!{<><h2>{l.t(title)}</h2><p>{l.t("Pokémon and Pokémon character names belong to Nintendo, Creatures Inc., and GAME FREAK inc. Atlas is not affiliated with or endorsed by them.")}</p><p>{l.t("Species data and artwork")}{": "}<a href="https://pokeapi.co/" target="_blank" rel="noreferrer">{"PokéAPI"}</a>{" · "}{l.t("3D models")}{": "}<a href="https://github.com/Pokemon-3D-api/assets" target="_blank" rel="noreferrer">{"Pokémon 3D API"}</a>{" · "}<a href="https://github.com/Lilothestitch16/Pokemon-HOME-GLB-Models" target="_blank" rel="noreferrer">{"Lilothestitch16 · Pokémon HOME"}</a></p><p>{l.t("Model detail and recorded animations vary by species. The collection covers the 1,025 numbered species; alternate forms are not all included.")}</p><p class="legal-links"><a href={self.legal("rights")}>{l.t("Rights & credits")}</a><a href={self.legal("terms")}>{l.t("Terms of use")}</a><a href={self.legal("privacy")}>{l.t("Privacy policy")}</a><a href="https://github.com/rrih/rrih.github.io/issues">{l.t("Contact")}</a></p></>},
          Some("install")=>html!{<><h2>{l.t(title)}</h2><p>{l.t("Install Atlas to open it like an app, with more room to explore.")}</p><div class="install-guide"><strong>{l.t("iPhone & iPad")}</strong><p>{l.t("Open in Safari, tap Share, then Add to Home Screen.")}</p><strong>{l.t("Android & desktop")}</strong><p>{l.t("Open the browser menu and choose Install app or Add to Home screen. If Atlas is already installed, open it from your home screen or apps.")}</p></div><p class="setting-note">{l.t("Your collection is stored on this device. New models require a connection; recently viewed models can remain available offline.")}</p></>},_=>Html::default()}}
        </dialog>}
    }
}
