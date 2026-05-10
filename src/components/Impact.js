import React, { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement } from 'chart.js';
import Breadcrumb from './Breadcrumb';
import { impactAPI } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement);

export default function Impact() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const atlasDashboardUrl = process.env.REACT_APP_ATLAS_IMPACT_DASHBOARD_URL;

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await impactAPI.getPublicSummary();
        setSummary(data);
      } catch (error) {
        console.error('Impact summary error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  const railData = {
    labels: (summary?.rails || []).map(item => `${item.paymentRail.toUpperCase()} ${item.currency.toUpperCase()}`),
    datasets: [
      {
        label: 'Donated',
        data: (summary?.rails || []).map(item => item.donatedDollars),
        backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
        borderRadius: 6
      }
    ]
  };

  const charityData = {
    labels: (summary?.charities || []).map(item => item.name),
    datasets: [
      {
        data: (summary?.charities || []).map(item => item.donatedDollars),
        backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6'],
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  const totals = summary?.totals || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        <div className="mb-8">
          <h1 className="text-headline text-gray-900 mb-2">Impact</h1>
          <p className="text-body text-gray-600">
            Public transparency across donations, settlement rails, and immutable receipts.
          </p>
        </div>

        {atlasDashboardUrl && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <iframe
              title="Charitap Atlas Impact Dashboard"
              src={atlasDashboardUrl}
              className="w-full min-h-[640px]"
              loading="lazy"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            ['Total Donated', `$${Number(totals.donatedDollars || 0).toFixed(2)}`],
            ['Transactions', totals.transactionCount || 0],
            ['Solana Receipts', totals.solanaSecured || 0],
            ['Charities', totals.charityCount || 0]
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="text-caption text-gray-600 mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900">{loading ? '...' : value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Settlement Rails</h2>
            <div className="h-72">
              {(summary?.rails || []).length ? (
                <Bar data={railData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">No public donations yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Supported Charities</h2>
            <div className="h-72">
              {(summary?.charities || []).length ? (
                <Doughnut data={charityData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">No charity totals yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
