import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card } from '../components/ui'
import FeaturesBlock from '../components/ui/features-4'

export function NotFoundPage() {
  return (
    <main className="not-found">
      <Card className="not-found__card">
        <div className="auth-card__icon"><Compass size={20} /></div>
        <span className="eyebrow">404 / route not found</span>
        <h1>Page not found.</h1>
        <p>The requested workspace path is not available.</p>
        <Link to="/dashboard"><Button><ArrowLeft size={16} />Return to dashboard</Button></Link>
      </Card>
      <div className="page-width mt-10">
        <FeaturesBlock />
      </div>
    </main>
  )
}

