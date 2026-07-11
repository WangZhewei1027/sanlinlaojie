"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** App-wide toast host. Mounted once in the root layout. */
export function Toaster(props: ToasterProps) {
  return <Sonner position="top-center" richColors closeButton {...props} />;
}
