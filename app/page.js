'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [measurements, setMeasurements] = useState([])
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '',
    waist_cm: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      if (user) {
        loadMeasurements()
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user)
          loadMeasurements()
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setMeasurements([])
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const loadMeasurements = async () => {
    const { data, error } = await supabase
      .from('body_measurements')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('Error loading measurements:', error)
    } else {
      setMeasurements(data || [])
    }
  }

  const saveMeasurement = async (e) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from('body_measurements')
      .upsert({
        user_id: user.id,
        date: formData.date,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
        notes: formData.notes || null
      })

    if (error) {
      console.error('Error saving measurement:', error)
      alert('Error saving measurement')
    } else {
      alert('Measurement saved!')
      setFormData({
        date: new Date().toISOString().split('T')[0],
        weight_kg: '',
        waist_cm: '',
        notes: ''
      })
      loadMeasurements()
    }
    
    setSaving(false)
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>🏃‍♂️ Health Tracker</h1>
          <p style={{ marginBottom: '30px', color: '#666' }}>
            Your personal health and fitness dashboard
          </p>
          <button onClick={signInWithGoogle} className="google-btn">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1>Health Tracker Dashboard</h1>
          <button onClick={signOut} className="logout-btn">
            Sign Out
          </button>
        </div>

        {/* Log New Measurement */}
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '20px' }}>Log Today's Measurements</h2>
          
          <form onSubmit={saveMeasurement}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date:</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Weight (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 85.5"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({...formData, weight_kg: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Waist (cm):</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 92.5"
                  value={formData.waist_cm}
                  onChange={(e) => setFormData({...formData, waist_cm: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notes (optional):</label>
              <textarea
                placeholder="How are you feeling? Any observations..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={saving}
              style={{ 
                background: '#007bff', 
                color: 'white', 
                border: 'none', 
                padding: '12px 24px', 
                borderRadius: '6px', 
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Measurement'}
            </button>
          </form>
        </div>

        {/* Recent Measurements */}
        <div>
          <h2 style={{ marginBottom: '20px' }}>Recent Measurements</h2>
          
          {measurements.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No measurements yet. Add your first one above!</p>
          ) : (
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Weight (kg)</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Waist (cm)</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((measurement, index) => (
                    <tr key={measurement.id} style={{ background: index % 2 === 0 ? 'white' : '#f9f9f9' }}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                        {new Date(measurement.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                        {measurement.weight_kg || '-'}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                        {measurement.waist_cm || '-'}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                        {measurement.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
