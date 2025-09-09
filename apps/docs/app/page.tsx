import React from "react";
import dynamic from "next/dynamic";

import TimelineExamples from "@/components/example";

// const TimelineExamples = dynamic(
//   function loadTimeline() {
//     return import("@/components/example");
//   },
//   { ssr: false }
// );

export default function Page() {
  return (
    <main>
      <React.Suspense fallback={<p>Loading timeline...</p>}>
        <TimelineExamples />
      </React.Suspense>
    </main>
  );
}
