// GitHub Pages의 프로젝트 페이지는 도메인 루트가 아니라 /AstroGame/ 같은
// 하위 경로에서 서빙된다. vite.config.ts의 base가 그 경로를 정하고,
// Vite는 그 값을 import.meta.env.BASE_URL로 넘겨준다(개발 서버에서는 '/').
// index.html의 script/link 태그는 Vite가 빌드 시 알아서 base를 붙여주지만,
// 런타임에 문자열로 조립하는 절대경로(엔진 wasm, skydata, 이미지 등)는
// Vite가 손댈 수 없으므로 이 헬퍼를 거쳐야 한다.
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
