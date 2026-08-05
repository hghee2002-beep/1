import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  level = 2,
}: SectionHeadingProps) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {description ? (
          <p className="section-description">{description}</p>
        ) : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}
