import Link from "next/link";

import type { AdminListQuery } from "@/features/admin/validation";
import type { AdminTableData } from "@/server/admin/read";
import { StatusBadge } from "@/components/system/status-badge";

function statusTone(status: string) {
  if (
    /ACTIVE|APPROVED|CONNECTED|PUBLISHED|COMPLETED|PROCESSED|OK|ENABLED/u.test(
      status,
    )
  ) {
    return "ready" as const;
  }
  if (/FAILED|ERROR|INVALID|LOCKED|DISABLED|MISMATCH|REMOVED/u.test(status)) {
    return "loss" as const;
  }
  if (/PENDING|SEALED|SCHEDULED|WARNING|MOCK|MANUAL/u.test(status)) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function pageHref(section: string, query: AdminListQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("page", String(page));
  params.set("pageSize", String(query.pageSize));
  return `/admin/${section}?${params.toString()}`;
}

export function AdminTableView({
  section,
  data,
  query,
}: {
  section: string;
  data: AdminTableData;
  query: AdminListQuery;
}) {
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <>
      <form className="admin-toolbar" method="get" action={`/admin/${section}`}>
        <label>
          <span className="sr-only">검색</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="이름, ID, 작업 검색"
          />
        </label>
        <label>
          <span className="sr-only">상태 필터</span>
          <select name="status" defaultValue={query.status}>
            <option value="">전체 상태</option>
            {data.statusOptions.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <button type="submit">검색 적용</button>
        <Link href={`/admin/${section}`}>초기화</Link>
        <span>
          {data.total}건 · {data.page}/{pageCount}쪽
        </span>
      </form>
      {data.note ? <p className="admin-data-note">{data.note}</p> : null}
      <div className="simple-table-wrap admin-table-wrap" tabIndex={0}>
        <table className="data-table simple-table admin-table">
          <caption className="sr-only">관리자 {section} 목록</caption>
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, index) =>
                    index === 0 ? (
                      <th scope="row" key={`${row.id}-${index}`}>
                        {cell}
                      </th>
                    ) : cell.includes(row.status) ? (
                      <td key={`${row.id}-${index}`}>
                        <StatusBadge
                          label={cell}
                          tone={statusTone(row.status)}
                        />
                      </td>
                    ) : (
                      <td key={`${row.id}-${index}`}>{cell}</td>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(1, data.columns.length)}>
                  조건에 맞는 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav className="admin-pagination" aria-label="관리자 목록 페이지">
        {data.page > 1 ? (
          <Link href={pageHref(section, query, data.page - 1)}>이전</Link>
        ) : (
          <span aria-disabled="true">이전</span>
        )}
        <strong>
          {data.page} / {pageCount}
        </strong>
        {data.page < pageCount ? (
          <Link href={pageHref(section, query, data.page + 1)}>다음</Link>
        ) : (
          <span aria-disabled="true">다음</span>
        )}
      </nav>
    </>
  );
}
