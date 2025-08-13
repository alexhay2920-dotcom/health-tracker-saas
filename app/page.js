'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [measurementTypes, setMeasurementTypes] = useState([])
  const [latestMeasurements, setLatestMeasurements] = useState({})
  const [previousMeasurements, setPreviousMeasurements] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [modalData, setModalData] = useState({
    value: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5)
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
        await loadMeasurementTypes()
        await loadLatestMeasurements()
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user)
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLatestMeasurements({})
          setPreviousMeasurements({})
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const loadMeasurementTypes = async () => {
    const { data, error } = await supabase
      .from('measurement_types')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading measurement types:', error)
    } else {
      setMeasurementTypes(data || [])
    }
  }

  const loadLatestMeasurements = async () => {
    // Get latest measurements for each type
    const { data: latest, error: latestError } = await supabase
      .from('measurements')
      .select(`
        *,
        measurement_types (name, unit)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (latestError) {
      console.error('Error loading latest measurements:', latestError)
      return
    }

    // Group by measurement type and get the latest for each
    const latestByType = {}
    const previousByType = {}
    
    latest.forEach(measurement => {
      const typeName = measurement.measurement_types.name
      if (!latestByType[typeName]) {
        latestByType[typeName] = measurement
      } else if (!previousByType[typeName]) {
        previousByType[typeName] = measurement
      }
    })

    setLatestMeasurements(latestByType)
    setPreviousMeasurements(previousByType)
  }

  const openModal = (measurementType) => {
    setModalType(measurementType)
    setModalData({
      value: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalType(null)
    setModalData({
      value: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    })
  }

  const saveMeasurement = async (e) => {
    e.preventDefault()
    setSaving(true)

    if (!modalData.value) {
      alert('Please enter a measurement value')
      setSaving(false)
      return
    }

    // Combine date and time
    const datetime = new Date(`${modalData.date}T${modalData.time}`)

    const { error } = await supabase
      .from('measurements')
      .upsert({
        user_id: user.id,
        measurement_type_id: modalType.id,
        value: parseFloat(modalData.value),
        date: modalData.date,
        created_at: datetime.toISOString()
      })

    if (error) {
      console.error('Error saving measurement:', error)
      alert('Error saving measurement: ' + error.message)
    } else {
      closeModal()
      await loadLatestMeasurements()
    }
    
    setSaving(false)
  }

  const formatDateTime = (dateStr, createdAt) => {
    const date = new Date(createdAt || dateStr)
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${time} ${day}`
  }

  const calculateChange = (latest, previous) => {
    if (!latest || !previous) return null
    const change = latest.value - previous.value
    return {
      value: Math.abs(change).toFixed(1),
      isIncrease: change > 0,
      isDecrease: change < 0
    }
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

  const weightType = measurementTypes.find(type => type.name === 'Weight')
  const waistType = measurementTypes.find(type => type.name === 'Waist')

  return (
    <>
      <style jsx>{`
        .dashboard-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          background: white;
          padding: 20px 30px;
          border-radius: 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .dashboard-title {
          font-size: 28px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }

        .logout-btn {
          background: #ff4757;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        .logout-btn:hover {
          background: #ff3838;
        }

        .widgets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .widget {
          background: white;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          border: 1px solid #f0f0f0;
        }

        .widget:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }

        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .widget-title {
          font-size: 16px;
          font-weight: 600;
          color: #666;
          margin: 0;
        }

        .add-btn {
          background: #007bff;
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
          transition: background 0.2s;
        }

        .add-btn:hover {
          background: #0056b3;
        }

        .measurement-value {
          font-size: 48px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0;
          line-height: 1;
        }

        .measurement-unit {
          font-size: 24px;
          color: #666;
          margin-left: 8px;
        }

        .measurement-date {
          font-size: 14px;
          color: #999;
          margin-top: 8px;
        }

        .change-indicator {
          display: flex;
          align-items: center;
          margin-top: 12px;
          font-size: 14px;
          font-weight: 600;
        }

        .change-arrow {
          margin-right: 4px;
          font-size: 16px;
        }

        .change-positive {
          color: #dc3545;
        }

        .change-negative {
          color: #28a745;
        }

        .no-data {
          text-align: center;
          color: #999;
          font-style: italic;
          padding: 40px 20px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 16px;
          padding: 32px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #999;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .save-btn {
          width: 100%;
          background: #007bff;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .save-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Health Dashboard</h1>
          <button onClick={signOut} className="logout-btn">
            Sign Out
          </button>
        </div>

        <div className="widgets-grid">
          {/* Weight Widget */}
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Current Weight</h3>
              {weightType && (
                <button 
                  className="add-btn" 
                  onClick={() => openModal(weightType)}
                  title="Add weight measurement"
                >
                  +
                </button>
              )}
            </div>
            
            {latestMeasurements['Weight'] ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span className="measurement-value">
                    {latestMeasurements['Weight'].value}
                  </span>
                  <span className="measurement-unit">kg</span>
                </div>
                <div className="measurement-date">
                  {formatDateTime(latestMeasurements['Weight'].date, latestMeasurements['Weight'].created_at)}
                </div>
                {previousMeasurements['Weight'] && (() => {
                  const change = calculateChange(latestMeasurements['Weight'], previousMeasurements['Weight'])
                  if (change && (change.isIncrease || change.isDecrease)) {
                    return (
                      <div className={`change-indicator ${change.isIncrease ? 'change-positive' : 'change-negative'}`}>
                        <span className="change-arrow">
                          {change.isIncrease ? '↗' : '↘'}
                        </span>
                        {change.value} kg
                      </div>
                    )
                  }
                  return null
                })()}
              </>
            ) : (
              <div className="no-data">
                No weight measurements yet.<br />
                Click + to add your first measurement.
              </div>
            )}
          </div>

          {/* Waist Widget */}
          <div className="widget">
            <div className="widget-header">
              <h3 className="widget-title">Current Waist Circumference</h3>
              {waistType && (
                <button 
                  className="add-btn" 
                  onClick={() => openModal(waistType)}
                  title="Add waist measurement"
                >
                  +
                </button>
              )}
            </div>
            
            {latestMeasurements['Waist'] ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span className="measurement-value">
                    {latestMeasurements['Waist'].value}
                  </span>
                  <span className="measurement-unit">cm</span>
                </div>
                <div className="measurement-date">
                  {formatDateTime(latestMeasurements['Waist'].date, latestMeasurements['Waist'].created_at)}
                </div>
                {previousMeasurements['Waist'] && (() => {
                  const change = calculateChange(latestMeasurements['Waist'], previousMeasurements['Waist'])
                  if (change && (change.isIncrease || change.isDecrease)) {
                    return (
                      <div className={`change-indicator ${change.isIncrease ? 'change-positive' : 'change-negative'}`}>
                        <span className="change-arrow">
                          {change.isIncrease ? '↗' : '↘'}
                        </span>
                        {change.value} cm
                      </div>
                    )
                  }
                  return null
                })()}
              </>
            ) : (
              <div className="no-data">
                No waist measurements yet.<br />
                Click + to add your first measurement.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for adding measurements */}
      {showModal && modalType && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add {modalType.name} Measurement</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={saveMeasurement}>
              <div className="form-group">
                <label className="form-label">
                  {modalType.name} ({modalType.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={modalType.name === 'Weight' ? 'e.g. 85.5' : 'e.g. 92.5'}
                  value={modalData.value}
                  onChange={(e) => setModalData({...modalData, value: e.target.value})}
                  className="form-input"
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={modalData.date}
                    onChange={(e) => setModalData({...modalData, date: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    value={modalData.time}
                    onChange={(e) => setModalData({...modalData, time: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                className="save-btn"
                disabled={saving}
              >
                {saving ? 'Saving...' : `Save ${modalType.name}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
