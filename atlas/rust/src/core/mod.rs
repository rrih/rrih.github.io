//! Browser-independent Atlas rules, shared by static generation and the WASM application.
pub mod advertising;
pub(crate) mod case;
pub mod catalog;
pub mod forms;
pub mod locales;
pub mod previews;
pub mod routes;
pub mod scene_files;
pub mod scene_link;
pub mod scene_studio;
pub mod seo;
pub mod telemetry;
pub mod types;

#[cfg(test)]
mod tests;
