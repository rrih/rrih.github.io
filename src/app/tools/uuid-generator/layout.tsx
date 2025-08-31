import { generateToolMetadata } from "@/lib/metadata";

export const metadata = generateToolMetadata("uuid-generator");

export default function UUIDGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
