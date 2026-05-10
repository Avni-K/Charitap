import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import Breadcrumb from './Breadcrumb';
import CollapsibleSection from './CollapsibleSection';
import useScrollAnimation from '../hooks/useScrollAnimation';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { dashboardAPI, roundUpAPI } from '../services/api';
import { useCountUp, formatCounterValue } from '../utils/counterAnimation';
// Confetti removed - only shown in extension popup
import { SkeletonStat, SkeletonCard } from './Skeleton';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const { isAuthenticated } = useAuth();
  const atlasDashboardUrl = process.env.REACT_APP_ATLAS_IMPACT_DASHBOARD_URL?.trim();
  const demoCharityBreakdown = [
    { name: 'Wellspring Women\'s Center', percentage: 42 },
    { name: 'Sacramento Food Bank', percentage: 28 },
    { name: 'Art of Being Program', percentage: 18 },
    { name: "Children's Corner", percentage: 12 }
  ];

  // Scroll animation refs
  const statsRef = useScrollAnimation(0.3);

  // State for dashboard data
  const [stats, setStats] = useState([
    { label: 'Total Donations', value: '$0.00' },
    { label: 'Last Month', value: '$0.00' },
    { label: 'Charities Supported', value: '0' },
    { label: 'Wallet Balance', value: '$0.00' },
    { label: 'Blockchain Secured', value: '0 of 0', sublabel: 'ResilientDB + Solana' }
  ]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [charityBreakdown, setCharityBreakdown] = useState([]);
  // Confetti state removed - only in extension
  const [loading, setLoading] = useState(true);

  // Animated counter values
  const [targetValues, setTargetValues] = useState({
    totalDonations: 0,
    lastMonth: 0,
    charitiesSupported: 0,
    walletBalance: 0,
    blockchainSecured: 0,
    totalTransactions: 0
  });

  // Animated counter hooks - must be called at top level
  const animatedTotalDonations = useCountUp(targetValues.totalDonations, 2000);
  const animatedLastMonth = useCountUp(targetValues.lastMonth, 2000);
  const animatedCharitiesSupported = useCountUp(targetValues.charitiesSupported, 2000);
  const animatedWalletBalance = useCountUp(targetValues.walletBalance, 2000);
  const animatedBlockchainSecured = useCountUp(targetValues.blockchainSecured, 2000);
  const animatedTotalTransactions = useCountUp(targetValues.totalTransactions, 2000);

  // Fetch dashboard data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      console.log('Dashboard: isAuthenticated =', isAuthenticated);
      if (!isAuthenticated) {
        console.log('Dashboard: Not authenticated, skipping data fetch');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Dashboard: Fetching data from backend...');

        // Fetch all dashboard metrics in parallel
        const [totalDonated, pendingData, uniqueCharities, monthlyDonations, charityBreakdownData, blockchainStats] = await Promise.all([
          dashboardAPI.getTotalDonated().catch(err => { console.error('getTotalDonated error:', err); return { totalDonated: '0.00', transactionCount: 0 }; }),
          roundUpAPI.getPending().catch(err => { console.error('getPending error:', err); return { totalAmount: '0.00', count: 0 }; }),
          dashboardAPI.getUniqueCharities().catch(err => { console.error('getUniqueCharities error:', err); return { uniqueCharities: 0 }; }),
          dashboardAPI.getMonthlyDonations().catch(err => { console.error('getMonthlyDonations error:', err); return { monthlyDonations: [] }; }),
          dashboardAPI.getCharityBreakdown().catch(err => { console.error('getCharityBreakdown error:', err); return { charities: [], totalDonated: 0 }; }),
          dashboardAPI.getBlockchainStats().catch(err => { console.error('getBlockchainStats error:', err); return { totalTransactions: 0, blockchainSecured: 0 }; })
        ]);

        console.log('Dashboard: Data received:', {
          totalDonated,
          pendingData,
          uniqueCharities,
          monthlyDonations,
          charityBreakdownData,
          blockchainStats
        });

        // Calculate Last Month amount - get previous month's donations
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-indexed

        // For February 2026, last month would be January 2026 (month index 0)
        let lastMonthAmount = 0;
        if (monthlyDonations.monthlyDonations && monthlyDonations.monthlyDonations.length > 0) {
          // Find previous month's data
          const lastMonthData = monthlyDonations.monthlyDonations.find(m => {
            // Current month is February (1), so last month is January (0)
            return m.monthNumber === currentMonth; // Previous month
          });
          lastMonthAmount = lastMonthData?.amount || 0;
        }

        // Calculate blockchain stats
        const totalTransactions = blockchainStats.totalTransactions || 0;
        const blockchainSecured = Math.max(blockchainStats.blockchainSecured || 0, blockchainStats.solanaSecured || 0);

        const newStats = [
          { label: 'Total Donations', value: `$${parseFloat(totalDonated.totalDonated || 0).toFixed(2)}` },
          { label: 'Last Month', value: `$${parseFloat(lastMonthAmount).toFixed(2)}` },
          { label: 'Charities Supported', value: String(uniqueCharities.uniqueCharities || 0) },
          { label: 'Wallet Balance', value: `$${parseFloat(pendingData.totalAmount || 0).toFixed(2)}` },
          { label: 'Blockchain Secured', value: `${blockchainSecured} of ${totalTransactions}`, sublabel: 'ResilientDB + Solana' }
        ];

        console.log('Dashboard: Setting stats to:', newStats);
        setStats(newStats);

        // Set target values for animations
        setTargetValues({
          totalDonations: parseFloat(totalDonated.totalDonated || 0),
          lastMonth: parseFloat(lastMonthAmount),
          charitiesSupported: parseInt(uniqueCharities.uniqueCharities || 0),
          walletBalance: parseFloat(pendingData.totalAmount || 0),
          blockchainSecured: parseInt(blockchainSecured),
          totalTransactions: parseInt(totalTransactions)
        });

        // Confetti removed - only shown in extension popup

        // Update monthly data
        const monthlyDonationsData = monthlyDonations.monthlyDonations || [];
        setMonthlyData(monthlyDonationsData);
        console.log('Dashboard: Monthly data set:', {
          length: monthlyDonationsData.length,
          data: monthlyDonationsData
        });

        // Update charity breakdown
        setCharityBreakdown(charityBreakdownData.charities || []); // FIXED: was charityBreakdown

        console.log('Dashboard: Data update complete');
        setLoading(false);
      } catch (error) {
        console.error('Dashboard: Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Listen for real-time wallet updates from extension
    const handleWalletUpdate = (event) => {
      if (event.data && event.data.type === 'CHARITAP_WALLET_UPDATE') {
        console.log('Dashboard: Received wallet update message, refetching data...');
        fetchDashboardData();
      }
    };
    
    window.addEventListener('message', handleWalletUpdate);
    
    return () => {
      window.removeEventListener('message', handleWalletUpdate);
    };
  }, [isAuthenticated]);

  // Chart data - dynamically generated from backend data (YTD only)
  const currentYear = new Date().getFullYear();
  const ytdMonthlyData = monthlyData.filter(m => !m.year || m.year === currentYear);
  
  const monthlySpendingData = {
    labels: ytdMonthlyData.map(m => {
      // If month has year property, show "Month Year", otherwise just month name
      if (m.year) {
        return `${m.month} ${m.year}`;
      }
      return m.month?.substring(0, 3) || 'N/A';
    }),
    datasets: [
      {
        label: 'Monthly Donations',
        data: ytdMonthlyData.map(m => parseFloat(m.amount || 0)),
        backgroundColor: 'rgba(251, 191, 36, 0.8)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }
    ]
  };

  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#6B7280', '#EC4899', '#14B8A6'];
  const displayCharityBreakdown = charityBreakdown && charityBreakdown.length > 0 ? charityBreakdown : demoCharityBreakdown;
  const charitiesSupportedData = {
    labels: displayCharityBreakdown.map(c => c.name || 'Unknown'),  // FIXED: was c.charityName
    datasets: [
      {
        data: displayCharityBreakdown.map(c => parseFloat(c.percentage || 0)),
        backgroundColor: displayCharityBreakdown.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Confetti removed - only shown in extension popup */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-headline text-gray-900 mb-2">
            Dashboard
          </h1>
          <p className="text-body text-gray-600">
            Here's your donation impact, Solana rails, and Atlas-backed transparency summary.
          </p>
        </div>

        {/* Stats Cards */}
        <div 
          ref={statsRef}
          className="scroll-animate grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
        >
          { loading ? (
            // Show skeleton loaders while data is loading
            Array.from({ length: 5 }).map((_, index) => (
              <SkeletonStat key={index} />
            ))
          ) : (
            stats.map((stat, index) => {
              // Animated counter value
              let displayValue = stat.value;
              if (index === 0) displayValue = formatCounterValue(animatedTotalDonations, 'currency');
              else if (index === 1) displayValue = formatCounterValue(animatedLastMonth, 'currency');
              else if (index === 2) displayValue = Math.floor(animatedCharitiesSupported || displayCharityBreakdown.length).toString();
              else if (index === 3) displayValue = formatCounterValue(animatedWalletBalance, 'currency');
              else if (index === 4) displayValue = `${Math.floor(animatedBlockchainSecured)} of ${Math.floor(animatedTotalTransactions)}`;

              return (
                <div
                  key={index}
                  className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300 transform hover:scale-105 ${index === 4 ? 'bg-gradient-to-br from-yellow-50 to-green-50 border-yellow-300' : ''
                    }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="mb-2">
                    <h3 className="text-caption text-gray-600">{stat.label}</h3>
                  </div>
                  <p className={`text-3xl font-bold ${index === 4 ? 'text-yellow-600' : 'text-gray-900'
                    }`}>{displayValue}</p>
                  {stat.sublabel && (
                    <p className="text-xs text-gray-500 mt-1">{stat.sublabel}</p>
                  )}
                  {index === 4 && !stat.value.startsWith('0/0') && stat.value !== '0' && (
                    <div className="mt-2 inline-flex items-center text-xs font-bold text-green-700">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Verified
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {atlasDashboardUrl && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">MongoDB Atlas Dashboard</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Charts are embedded directly from Atlas. No API key is needed here, only the share/embed URL.
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold uppercase tracking-wide self-start">
                Atlas embed
              </span>
            </div>
            <div className="p-4 sm:p-6">
              <iframe
                title="Charitap Atlas Dashboard"
                src={atlasDashboardUrl}
                className="w-full min-h-[720px] rounded-lg border border-gray-100 bg-white"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {!atlasDashboardUrl && (
          <>
            {/* Analytics Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 hover:shadow-md transition-all duration-300">
              <div className="p-6">
                <div className="space-y-8">
              {/* Monthly Spending Chart */}
              <CollapsibleSection 
                title="Monthly Donation Trends" 
                defaultOpen={true}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                <div className="p-4 md:p-6">
                  {loading ? (
                    <SkeletonCard />
                  ) : monthlyData.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Donation Data Yet</h3>
                      <p className="text-gray-500 mb-4">Start making donations to see your monthly trends!</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <div className="min-w-[500px] md:min-w-0">
                          <div className="h-64 md:h-80 transform transition-all duration-500 hover:scale-[1.02]">
                            <Bar data={monthlySpendingData} options={barChartOptions} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600">
                          Your donation activity over the past 12 months
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleSection>

              {/* Charities Supported Chart */}
              <CollapsibleSection 
                title="Charities Supported" 
                defaultOpen={true}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                }
              >
                <div className="p-4 md:p-6">
                  {loading ? (
                    <SkeletonCard />
                  ) : displayCharityBreakdown.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <div className="min-w-[300px] md:min-w-0">
                          <div className="h-64 md:h-80">
                            <Doughnut data={charitiesSupportedData} options={chartOptions} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center space-y-3 md:space-y-4">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Donation Distribution</h4>
                        {charitiesSupportedData.labels.map((label, index) => (
                          <div key={index} className="flex items-center justify-between transform transition-all duration-300 hover:scale-105">
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: charitiesSupportedData.datasets[0].backgroundColor[index] }}
                              ></div>
                              <span className="text-sm text-gray-700">{label}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {charitiesSupportedData.datasets[0].data[index]}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Charities Supported Yet</h3>
                      <p className="text-gray-500 mb-4">You haven't made any donations yet. Start making a difference today!</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
