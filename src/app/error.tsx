"use client";

type ErrorBoundaryProps = {
  reset: () => void;
};

export default function ErrorBoundary({ reset }: ErrorBoundaryProps) {
  return (
    <main id="main-content" className="state-page">
      <p className="section-label">SYSTEM ERROR</p>
      <h1>요청을 처리하지 못했습니다.</h1>
      <p>입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.</p>
      <button className="button-primary" type="button" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
