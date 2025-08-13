'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

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
  const weightChartRef = useRef(null)
  const waistChartRef = useRef(null)
  
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
      .insert({
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

  const createMiniChart = async (canvasRef, type) => {
    if (!canvasRef.current) return

    try {
      // Dynamic import of Chart.js
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      // Get last 7 measurements for the mini chart
      const { data: recentMeasurements, error } = await supabase
        .from('measurements')
        .select(`
          *,
          measurement_types (name, unit)
        `)
        .eq('measurement_types.name', type === 'weight' ? 'Weight' : 'Waist')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(7)

      if (error || !recentMeasurements || recentMeasurements.length < 2) return

      const data = recentMeasurements.map(m => m.value)
      const color = type === 'weight' ? '#3b82f6' : '#10b981'
      const unit = type === 'weight' ? 'kg' : 'cm'

      // Destroy existing chart if it exists
      if (canvasRef.current.chart) {
        canvasRef.current.chart.destroy()
      }

      const chart = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: recentMeasurements.map(m => new Date(m.datetime || m.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })),
          datasets: [{
            data: data,
            borderColor: color,
            backgroundColor: `${color}20`,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: color,
              borderWidth: 1,
              cornerRadius: 6,
              displayColors: false,
              callbacks: {
                title: function(context) {
                  const measurement = recentMeasurements[context[0].dataIndex]
                  return new Date(measurement.datetime || measurement.created_at).toLocaleDateString('en-GB', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                },
                label: function(context) {
                  return `${context.parsed.y} ${unit}`
                }
              }
            }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          },
          elements: {
            point: { radius: 0 }
          },
          interaction: { 
            intersect: false,
            mode: 'index'
          }
        }
      })

      // Store chart reference for cleanup
      canvasRef.current.chart = chart
    } catch (error) {
      console.error('Error creating mini chart:', error)
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

  // Update charts when measurements change
  useEffect(() => {
    if (latestMeasurements['Weight']) {
      createMiniChart(weightChartRef, 'weight')
    }
    if (latestMeasurements['Waist']) {
      createMiniChart(waistChartRef, 'waist')
    }
  }, [latestMeasurements])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-2xl p-10 shadow-2xl max-w-md w-full mx-4 text-center">
          <h1 className="text-3xl font-bold mb-4">🏃‍♂️ Health Tracker</h1>
          <p className="text-gray-600 mb-8">
            Your personal health and fitness dashboard
          </p>
          <button 
            onClick={signInWithGoogle} 
            className="flex items-center justify-center gap-3 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-10 bg-white rounded-2xl p-6 shadow-lg">
          <h1 className="text-3xl font-bold text-gray-800">Health Dashboard</h1>
          <button 
            onClick={signOut} 
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weight Widget */}
          <div className="bg-white rounded-2xl p-7 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-600">Weight</h3>
              {weightType && (
                <button 
                  onClick={() => openModal(weightType)}
                  className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold hover:bg-blue-700 transition-colors"
                  title="Add weight measurement"
                >
                  +
                </button>
              )}
            </div>
            
            {latestMeasurements['Weight'] ? (
              <>
                <div className="flex items-baseline gap-4 mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-800">
                      {latestMeasurements['Weight'].value}
                    </span>
                    <span className="text-2xl text-gray-500">kg</span>
                  </div>
                  {previousMeasurements['Weight'] && (() => {
                    const change = calculateChange(latestMeasurements['Weight'], previousMeasurements['Weight'])
                    if (change && (change.isIncrease || change.isDecrease)) {
                      return (
                        <div className={`flex items-center text-sm font-semibold ${change.isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                          <span className="text-base mr-1">
                            {change.isIncrease ? '↗' : '↘'}
                          </span>
                          {change.value}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
                <div className="text-sm text-gray-500 mb-3">
                  {formatDateTime(latestMeasurements['Weight'].date, latestMeasurements['Weight'].created_at)}
                </div>
                <div className="w-full h-[18px]">
                  <canvas ref={weightChartRef} className="w-full h-full"></canvas>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 italic py-10">
                No weight measurements yet.<br />
                Click + to add your first measurement.
              </div>
            )}
          </div>

          {/* Waist Widget */}
          <div className="bg-white rounded-2xl p-7 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-600">Waist Circumference</h3>
              {waistType && (
                <button 
                  onClick={() => openModal(waistType)}
                  className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold hover:bg-blue-700 transition-colors"
                  title="Add waist measurement"
                >
                  +
                </button>
              )}
            </div>
            
            {latestMeasurements['Waist'] ? (
              <>
                <div className="flex items-baseline gap-4 mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-800">
                      {latestMeasurements['Waist'].value}
                    </span>
                    <span className="text-2xl text-gray-500">cm</span>
                  </div>
                  {previousMeasurements['Waist'] && (() => {
                    const change = calculateChange(latestMeasurements['Waist'], previousMeasurements['Waist'])
                    if (change && (change.isIncrease || change.isDecrease)) {
                      return (
                        <div className={`flex items-center text-sm font-semibold ${change.isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                          <span className="text-base mr-1">
                            {change.isIncrease ? '↗' : '↘'}
                          </span>
                          {change.value}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
                <div className="text-sm text-gray-500 mb-3">
                  {formatDateTime(latestMeasurements['Waist'].date, latestMeasurements['Waist'].created_at)}
                </div>
                <div className="w-full h-[18px]">
                  <canvas ref={waistChartRef} className="w-full h-full"></canvas>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 italic py-10">
                No waist measurements yet.<br />
                Click + to add your first measurement.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for adding measurements */}
      {showModal && modalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Add {modalType.name} Measurement</h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={saveMeasurement}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {modalType.name} ({modalType.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={modalType.name === 'Weight' ? 'e.g. 85.5' : 'e.g. 92.5'}
                  value={modalData.value}
                  onChange={(e) => setModalData({...modalData, value: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg text-lg focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={modalData.date}
                    onChange={(e) => setModalData({...modalData, date: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                  <input
                    type="time"
                    value={modalData.time}
                    onChange={(e) => setModalData({...modalData, time: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : `Save ${modalType.name}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
