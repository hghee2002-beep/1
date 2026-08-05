import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="state-page">
      <p className="section-label">404 · NOT FOUND</p>
      <h1>요청한 페이지를 찾을 수 없습니다.</h1>
      <p>주소를 다시 확인하거나 시작 화면으로 이동해 주세요.</p>
      <Link className="button-primary" href="/">
        시작 화면으로
      </Link>
    </main>
  );
}
