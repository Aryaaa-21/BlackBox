import AuthSwitch from '../../components/ui/auth-switch'
import FeaturesBlock from '../../components/ui/features-4'

export function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      <AuthSwitch initialMode="signin" />
      <div className="w-full bg-slate-950/60 border-t border-slate-800/80 relative z-10">
        <FeaturesBlock />
      </div>
    </div>
  )
}

