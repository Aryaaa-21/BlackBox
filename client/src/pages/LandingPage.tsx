import { ArrowRight, Check, ChevronRight, Radio, Shield, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import { HeroSection } from '../components/landing/HeroSection'
import { PublicLayout } from '../components/layout/PublicLayout'
import FeaturesBlock from '../components/ui/features-4'

export function LandingPage() {
  return (
    <PublicLayout>
      <main className="landing">
        <HeroSection />

        <section className="landing__flow page-width" id="operations" aria-label="Operational continuity flow">
          {['CONNECTED', 'NETWORK LOST', 'LOCAL OPERATIONS', 'NETWORK RESTORED', 'SYNC', 'REPLAY'].map((step, index) => <div className="flow-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>{index < 5 ? <ChevronRight size={15} aria-hidden="true" /> : null}</div>)}
        </section>
        <section className="landing__principles page-width" id="reliability">
          <div className="section-intro"><span className="eyebrow">Operational continuity</span><h2>Mission work that survives the handoff.</h2><p>Keep field work moving, make synchronization explicit, and reconstruct what happened from the event history.</p></div>
          <div className="principle-grid"><Card><div className="principle-icon"><Radio size={18} /></div><h3>Signal, not spectacle</h3><p>Important changes have a consistent place and visual language.</p></Card><Card><div className="principle-icon"><WifiOff size={18} /></div><h3>Offline is a state</h3><p>The interface can acknowledge a gap without becoming a dead end.</p></Card><Card><div className="principle-icon"><Shield size={18} /></div><h3>Context stays close</h3><p>Navigation and session context remain present as work expands.</p></Card></div>
        </section>
        <FeaturesBlock className="page-width" />
        <section className="landing__footer-cta page-width"><div><span className="eyebrow eyebrow--accent">BlackBox operations</span><h2>A steadier surface for the work ahead.</h2></div><Link to="/dashboard" className="text-link text-link--bright">Open operations console <ArrowRight size={15} /></Link></section>
      </main>
    </PublicLayout>
  )
}

