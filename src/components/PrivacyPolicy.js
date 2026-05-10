import React from 'react';

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl w-full bg-white shadow-xl rounded-2xl p-8 space-y-6 text-gray-800 font-sans">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-700 to-green-500 mb-6 text-center">
                    Privacy Policy
                </h1>
                <p className="text-sm text-gray-500 text-center uppercase tracking-widest shadow-sm rounded p-2 bg-gray-100 font-semibold mb-8">
                    Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>

                <section className="space-y-4 border-l-4 border-green-500 pl-4 bg-green-50/30 p-4 rounded-r-lg hover:bg-green-50/80 transition-colors">
                    <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">1. Introduction</h2>
                    <p className="leading-relaxed">
                        Welcome to Charitap! This Privacy Policy explains how our browser extension and web application handle your data. We are committed to protecting your privacy and ensuring transparency regarding our data practices. Our primary mission is to facilitate seamless micro-donations during e-commerce checkouts.
                    </p>
                </section>

                <section className="space-y-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">2. Information We Collect</h2>
                    <p className="leading-relaxed">
                        The Charitap extension focuses on data minimization. We only collect the data strictly necessary for providing our service:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-green-500">
                        <li><strong>Authentication Data:</strong> To sync donations to your wallet, we securely store your User ID, Email, and authentication tokens in your browser's local storage.</li>
                        <li><strong>Checkout Data:</strong> On supported checkout pages, the extension reads the required order/cart total locally within your browser to calculate the suggested round-up amount. This data is not permanently stored or linked to individual shopping behavioral profiles.</li>
                        <li><strong>Donation History:</strong> When you agree to donate, we log the matched website's hostname and your donation amount to securely process the transaction.</li>
                    </ul>
                </section>

                <section className="space-y-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">3. How We Use and Share Your Data</h2>
                    <p className="leading-relaxed">
                        Charitap uses the collected information specifically to:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-green-500">
                        <li>Calculate round-up and process your charitable donations securely.</li>
                        <li>Maintain user sessions to provide a secure and frictionless experience without requiring constant logins.</li>
                        <li>Prevent duplicate widget popups utilizing a brief session cooldown period.</li>
                    </ul>
                    <p className="font-semibold text-gray-900 bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-4">
                        We <span className="underline decoration-wavy decoration-red-500">never</span> sell your data. We do not track your browsing history outside of necessary e-commerce checkout page detection. Personal payment information (credit card numbers, etc.) is never accessed, viewed, or stored by Charitap.
                    </p>
                </section>

                <section className="space-y-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">4. Your Rights and Data Deletion</h2>
                    <p className="leading-relaxed">
                        You maintain full control over your data.
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-green-500">
                        <li>You can view your entire donation history through our web dashboard.</li>
                        <li>Uninstalling the Charitap browser extension will automatically clear any local browser storage data used by the extension.</li>
                        <li>If you wish to delete your account or any related stored information, please contact us.</li>
                    </ul>
                </section>

                <section className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-inner">
                    <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">5. Contact Us</h2>
                    <p className="leading-relaxed">
                        If you have any questions or concerns about this Privacy Policy or our data practices, please reach out to us:
                    </p>
                    <div className="bg-white p-4 rounded shadow-sm flex items-center gap-3">
                        <span className="text-xl">✉️</span>
                        <a href="mailto:dwivedi.aman11@gmail.com" className="text-green-600 hover:text-green-800 font-semibold underline">dwivedi.aman11@gmail.com</a>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
