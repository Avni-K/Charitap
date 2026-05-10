import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import HeroGrid from './HeroGrid';
import RippleButton from './RippleButton';
import useScrollAnimation from '../hooks/useScrollAnimation';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  
  // Get display name from user data (firstName + lastName or displayName)
  const displayName = user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.displayName || 'User') : 'User';
  
  // Scroll animation refs
  const heroRef = useScrollAnimation(0.3);
  const featuresRef = useScrollAnimation(0.2);
  const howItWorksRef = useScrollAnimation(0.2);
  const ctaRef = useScrollAnimation(0.3);

  // Initialize Apple Pay / Google Pay
  useEffect(() => {
    const initializePaymentRequest = async () => {
      const stripe = await stripePromise;
      if (!stripe) return;

      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: 'Quick Donation',
          amount: 500, // $5.00 minimum
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      // Check if browser supports Apple Pay / Google Pay
      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr);
          setCanMakePayment(true);
        }
      });

      // Handle payment method event
      pr.on('paymentmethod', async (ev) => {
        try {
          // Send payment method to backend
          const response = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:3001'}/api/stripe/save-payment-method`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('charitap_auth') ? JSON.parse(localStorage.getItem('charitap_auth')).token : ''}`
            },
            body: JSON.stringify({
            })
          });

          const data = await response.json();

          if (data.success) {
            ev.complete('success');
            const pmType = data.paymentMethod?.type === 'apple_pay' ? 'Apple Pay' : data.paymentMethod?.type === 'google_pay' ? 'Google Pay' : 'Payment Method';
            alert(`${pmType} saved!\n\nAutomatic donations enabled:\n• Monthly on the 1st\n• OR when roundups reach $25\n\nManage in Settings.`);
            window.location.reload();
          } else {
            ev.complete('fail');
            alert('Payment failed. Please try again.');
          }
        } catch (error) {
          console.error('Payment error:', error);
          ev.complete('fail');
        }
      });
    };

    if (isAuthenticated) {
      initializePaymentRequest();
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
    window.location.href = '/signin';
  };

  // Feature card animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    })
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="scroll-animate relative overflow-hidden py-24 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Parallax background - pushed further down */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(1200px 600px at 50% -150px, rgba(253,230,138,0.35), transparent)', transform: 'translateZ(0)' }} />
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            {/* Left side - Text content */}
            <motion.div
              className="text-center lg:text-left relative z-20 mb-8 lg:mb-0"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Make a Difference
                <span className="block text-yellow-600">One Click at a Time</span>
              </h1>
              <p className="text-base md:text-lg text-gray-700 mb-8 max-w-2xl lg:max-w-none">
                Join thousands of people making micro-donations to causes that matter.
                Every penny counts, every click makes a difference, and every donation can settle through card rails or Solana USDC.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-black text-white text-xs font-semibold">
                  Stripe USD
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-200 text-yellow-900 text-xs font-semibold border border-yellow-300">
                  Solana USDC
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold border border-green-200">
                  ResilientDB receipts
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start items-stretch sm:items-center relative z-30">
                <RippleButton
                  onClick={() => window.open('https://chromewebstore.google.com/detail/round%E2%80%91up-charity/nmehghbeffbafflokkmfpcfbmichkhnk', '_blank')}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 relative z-30"
                >
                  Add to Chrome
                </RippleButton>

                {/* Payment Buttons - Show for authenticated users */}
                {isAuthenticated && (
                  <>
                    {/* Apple Pay / Google Pay Button (mobile/Safari) */}
                    {canMakePayment && paymentRequest && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                      >
                        <button
                          onClick={() => paymentRequest.show()}
                          className="bg-black hover:bg-gray-800 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                          Setup Payment Method
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-caption mt-4">
                  Already have an account? <button onClick={handleLogin} className="text-yellow-600 hover:text-yellow-700 font-medium">Log in</button>
                </p>
              )}
            </motion.div>
            
            {/* Right side - HeroGrid */}
            <motion.div
              className="flex justify-center lg:justify-end relative"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <div className="w-full max-w-md h-96 relative z-10">
                <HeroGrid />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Features Section - Enhanced with Motion */}
      <section
        ref={featuresRef}
        className="scroll-animate py-20 px-4 sm:px-6 lg:px-8 bg-white"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-headline text-gray-900 mb-4">
              Why Choose Charitap?
            </h2>
            <p className="text-body text-gray-600 max-w-2xl mx-auto">
              We make giving effortless and impactful with our innovative micro-donation platform.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                ),
                title: "Micro-Donations",
                description: "Give as little as $0.01 with every click. Small amounts add up to big impact."
              },
              {
                icon: (
                  <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Transparent Impact",
                description: "See exactly where your donations go in the dashboard, backed by Atlas charts and Solana receipts."
              },
              {
                icon: (
                  <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "Secure & Trusted",
                description: "Donations protected through secure card and wallet flows with verified charities."
              },
              {
                icon: (
                  <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: "Blockchain Verified",
                description: "Every donation permanently recorded on ResilientDB and mirrored to Solana for immutable transparency."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="text-center p-8 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-title text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-body text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section 
        ref={howItWorksRef}
        className="scroll-animate py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-headline text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-body text-gray-600 max-w-2xl mx-auto">
              Getting started with Charitap is simple and takes just a few minutes. 
              Start making a difference with every click.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
            {[
              { 
                step: "1", 
                title: "Install Extension", 
                description: "Add Charitap to your Chrome browser in just one click from the Chrome Web Store",
                icon: (
                  <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                color: "from-yellow-400 to-orange-500"
              },
              { 
                step: "2", 
                title: "Choose Causes", 
                description: "Select from hundreds of verified charities that align with your values and interests",
                icon: (
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                ),
                color: "from-green-400 to-blue-500"
              },
              { 
                step: "3", 
                title: "Browse & Click", 
                description: "Donate automatically while you browse. Every click can settle through Stripe or Solana USDC when your wallet is connected.",
                icon: (
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: "from-blue-400 to-purple-500"
              },
              { 
                step: "4", 
                title: "Track Impact", 
                description: "See real-time updates in your dashboard, backed by Atlas charts and on-chain receipts.",
                icon: (
                  <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                color: "from-purple-400 to-pink-500"
              }
            ].map((item, index) => (
              <div key={index} className="relative group h-full">
                {/* Connection line (except for last item) */}
                {index < 3 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent z-0" />
                )}
                
                <div 
                  className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-105 border border-gray-100 h-full flex flex-col"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  {/* Step number with gradient background */}
                  <div className={`w-16 h-16 bg-gradient-to-r ${item.color} rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-110`}>
                    {item.step}
                  </div>
                  
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-yellow-100 hover:scale-110">
                      {item.icon}
                    </div>
                  </div>
                  
                  <h3 className="text-title text-gray-900 mb-3 text-center font-semibold transition-colors duration-300 hover:text-yellow-600">{item.title}</h3>
                  <p className="text-body text-gray-600 text-center leading-relaxed transition-colors duration-300 hover:text-gray-700 flex-1">{item.description}</p>
                  
                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section 
        ref={ctaRef}
        className="scroll-animate py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-yellow-400 to-orange-500"
      >
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {isAuthenticated ? (
            <>
              <h2 className="text-headline text-white mb-6">
                Welcome back, {displayName || 'User'}!
              </h2>
              <p className="text-body text-yellow-100 mb-8">
                Ready to continue making a difference? Check your dashboard to see your card and Solana impact.
              </p>
              <RippleButton
                onClick={() => window.location.href = '/dashboard'}
                className="bg-white text-yellow-600 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Go to Dashboard
              </RippleButton>
            </>
          ) : (
            <>
              <h2 className="text-headline text-white mb-6">
                Ready to Start Making a Difference?
              </h2>
              <p className="text-body text-yellow-100 mb-8">
                Join thousands of people who are already making micro-donations through card rails and Solana USDC.
              </p>
              <RippleButton
                onClick={() => window.location.href = '/signup'}
                className="bg-white text-yellow-600 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Join Now
              </RippleButton>
            </>
          )}
        </motion.div>
      </section>
    </div>
  );
};

export default Home;
