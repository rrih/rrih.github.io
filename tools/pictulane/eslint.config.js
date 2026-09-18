import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','node_modules/**']},js.configs.recommended,...ts.configs.recommended,{languageOptions:{globals:Object.fromEntries(['self','URL','Response','Request','caches','fetch','console','setTimeout','clearTimeout','AbortController','MessageChannel','window','document','navigator','localStorage','history','location','DOMParser','Image','HTMLElement','performance','requestAnimationFrame','process','Buffer'].map(k=>[k,'readonly']))},rules:{'no-undef':'off'}});
