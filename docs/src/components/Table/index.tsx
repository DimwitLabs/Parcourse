import type { ComponentProps } from "react";

export default function Table(props: ComponentProps<"table">) {
  return (
    <div className="table-scroll">
      <table {...props} />
    </div>
  );
}
