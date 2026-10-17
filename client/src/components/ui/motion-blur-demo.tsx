import MotionBlurText from "@/components/ui/motion-blur-text";

export default function MotionBlurDemo() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center bg-transparent p-8">
      <MotionBlurText
        color="#e8f0fa"
        className="text-6xl font-semibold tracking-tight text-white"
      >
        Motion Blur Text
      </MotionBlurText>
    </div>
  );
}
