import { redirect } from "next/navigation";

// Landing screen comes later in the build order; until then, open the chair board.
export default function Home() {
  redirect("/merchant");
}
