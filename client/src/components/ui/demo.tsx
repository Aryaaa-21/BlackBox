import MotionBlurText from "@/components/ui/motion-blur-text";

export default function Default() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center bg-white p-8">
      <MotionBlurText
        color="black"
        className="text-6xl font-semibold tracking-tight text-black"
      >
        Motion Blur Text
      </MotionBlurText>
    </div>
  );
}
