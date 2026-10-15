"use client";

import SmokyButton from "@/components/ui/smoky-button";

const colors = {
  primary: "#002FA7",
  secondary: "#5C331F",
  shadow: "#050506",
};

export default function SmokyButtonDemo() {
  return (
    <main className="smoky-demo">
      <div className="smoky-demo__content">
        <SmokyButton colors={colors}>Smoky Button</SmokyButton>
      </div>
    </main>
  );
}
