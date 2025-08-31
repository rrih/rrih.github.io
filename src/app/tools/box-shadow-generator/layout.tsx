import { generateToolMetadata } from "@/lib/metadata";

export const metadata = generateToolMetadata("box-shadow-generator");

export default function BoxShadowGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
