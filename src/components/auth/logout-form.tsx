export function LogoutForm({
  className,
  children = "로그아웃",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action="/api/auth/logout" method="post">
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}
