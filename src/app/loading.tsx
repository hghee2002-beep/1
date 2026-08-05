export default function Loading() {
  return (
    <main
      className="page-container"
      aria-busy="true"
      aria-label="페이지 불러오는 중"
    >
      <div className="loading-bar" />
      <div className="loading-grid">
        <div className="loading-block loading-block-wide" />
        <div className="loading-block" />
      </div>
      <span className="sr-only">페이지를 불러오고 있습니다.</span>
    </main>
  );
}
