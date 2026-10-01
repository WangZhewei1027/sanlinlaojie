// Geist ships in the `geist` package, so the build never downloads fonts
// (next/font/google stalls on servers that cannot reach Google).
import { GeistSans } from "geist/font/sans";

export const geistSans = GeistSans;
