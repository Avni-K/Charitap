import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { settingsAPI } from '../services/api';
import RippleButton from './RippleButton';

/**
 * Charity Nomination Component
 * Allows users to nominate a charity to join the Charitap platform
 */
export default function NominateCharity() {
  const [charityName, setCharityName] = useState('');
  const [charityEmail, setCharityEmail] = useState('');
  const [category, setCategory] = useState('Other');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = [
    'Environment',
    'Education',
    'Health',
    'Animals',
    'Human Rights',
    'Poverty',
    'Arts & Culture',
    'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!charityName.trim()) {
      toast.error('Please enter the charity name');
      return;
    }

    if (!charityEmail.trim()) {
      toast.error('Please enter the charity email');
      return;
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(charityEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (zipCode && !/^\d{5}$/.test(zipCode)) {
      toast.error('Please enter a valid 5-digit ZIP code');
      return;
    }

    setLoading(true);

    try {
      const response = await settingsAPI.nominateCharity({
        charityName: charityName.trim(),
        charityEmail: charityEmail.trim().toLowerCase(),
        category,
        zipCode
      });

      toast.success(response.message || 'Thank you! We\'ve notified the charity.');

      // Clear form
      setCharityName('');
      setCharityEmail('');
      setCategory('Other');
      setZipCode('');
    } catch (error) {
      // API call uses fetch and throws an Error containing the backend error string,
      // so we use error.message. Fallback checks for Axios-style error just in case.
      const errorMessage = error.message || error.response?.data?.error || 'Failed to submit nomination. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nominate-charity-container">
      <div className="nominate-charity-header">
        <h3>Suggest a Charity</h3>
        <p className="nominate-charity-subtitle">
          Know a great nonprofit that should be on Charitap? Let us know and we'll reach out to them!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="nominate-charity-form">
        <div className="form-group">
          <label htmlFor="charityName">
            Charity Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="charityName"
            value={charityName}
            onChange={(e) => setCharityName(e.target.value)}
            placeholder="e.g., American Red Cross"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="charityEmail">
            Charity Email <span className="required">*</span>
          </label>
          <input
            type="email"
            id="charityEmail"
            value={charityEmail}
            onChange={(e) => setCharityEmail(e.target.value)}
            placeholder="e.g., info@charity.org"
            disabled={loading}
            required
          />
          <small className="form-help">We'll send them an invitation email</small>
        </div>

        <div className="form-group">
          <label htmlFor="category">
            Category <span className="required">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
            required
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="zipCode">Charity ZIP code</label>
          <input
            type="text"
            id="zipCode"
            value={zipCode}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d{0,5}$/.test(value)) setZipCode(value);
            }}
            placeholder="e.g., 95814"
            disabled={loading}
            maxLength={5}
          />
          <small className="form-help">Used for local impact search when available</small>
        </div>

        <div className="form-actions">
          <RippleButton
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3.5 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Send Invitation'}
          </RippleButton>
        </div>
      </form>

      <div className="nominate-charity-info">
        <h4>What happens next?</h4>
        <ul>
          <li>The charity receives an invitation email</li>
          <li>Our team verifies their 501(c)(3) status</li>
          <li>They connect their bank account via Stripe</li>
          <li>They appear in your charity selection</li>
        </ul>
      </div>

      <style jsx>{`
        .nominate-charity-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .nominate-charity-header {
          margin-bottom: 24px;
        }

        .nominate-charity-header h3 {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .nominate-charity-subtitle {
          color: #666;
          font-size: 14px;
          margin: 0;
        }

        .nominate-charity-form {
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          color: #333;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .required {
          color: #e53e3e;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .form-help {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #718096;
        }

        .form-actions {
          margin-top: 24px;
        }

        .nominate-charity-info {
          background: #f7fafc;
          border-radius: 8px;
          padding: 16px;
        }

        .nominate-charity-info h4 {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          margin: 0 0 12px 0;
        }

        .nominate-charity-info ul {
          margin: 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        .nominate-charity-info li {
          margin-bottom: 8px;
          color: #4a5568;
          font-size: 13px;
          padding-left: 8px;
        }

        @media (max-width: 768px) {
          .nominate-charity-container {
            padding: 20px;
          }

          .nominate-charity-header h3 {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
