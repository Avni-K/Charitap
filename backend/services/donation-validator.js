const Charity = require('../models/Charity');

/**
 * Donation Validator Service
 * Enforces smart-contract-like validation rules on the backend
 * Provides the validation logic that would normally be in smart contracts
 */
class DonationValidator {
    constructor() {
        // Validation configuration
        this.MIN_DONATION_AMOUNT = 0.01; // Minimum $0.01
        this.MAX_DONATION_AMOUNT = 10000; // Maximum $10,000 per donation
        this.MAX_CHARITIES_PER_DONATION = 10; // Maximum charities in one donation
    }

    /**
     * Main validation function for donations
     * Mimics smart contract validation logic
     * 
     * @param {Object} donationData - Donation to validate
     * @param {number} donationData.amount - Donation amount in dollars
     * @param {Array} donationData.charities - Selected charities
     * @returns {Object} Validation result
     */
    validateDonation(donationData) {
        const errors = [];
        const appliedRules = [];

        try {
            // Rule 1: Validate amount
            if (!this.validateAmount(donationData.amount)) {
                errors.push(`Amount must be between $${this.MIN_DONATION_AMOUNT} and $${this.MAX_DONATION_AMOUNT}`);
            } else {
                appliedRules.push('amount_valid');
            }

            // Rule 2: Validate charities exist
            if (!donationData.charities || donationData.charities.length === 0) {
                errors.push('At least one charity must be selected');
            } else if (donationData.charities.length > this.MAX_CHARITIES_PER_DONATION) {
                errors.push(`Maximum ${this.MAX_CHARITIES_PER_DONATION} charities allowed per donation`);
            } else {
                appliedRules.push('charity_count_valid');
            }

            // Rule 3: Validate charity percentages (if provided)
            if (donationData.charities && donationData.charities.length > 0) {
                const hasPercentages = donationData.charities.some(c => c.percentage !== undefined);

                if (hasPercentages) {
                    if (!this.validatePercentages(donationData.charities)) {
                        errors.push('Charity percentages must sum to 100');
                    } else {
                        appliedRules.push('percentages_sum_100');
                    }
                } else {
                    // Equal distribution - auto-calculate
                    appliedRules.push('equal_distribution');
                }
            }

            // Rule 4: Validate charity IDs exist (basic check)
            const invalidCharities = donationData.charities.filter(c => !c._id && !c.charityId);
            if (invalidCharities.length > 0) {
                errors.push('All charities must have valid IDs');
            } else {
                appliedRules.push('charity_ids_valid');
            }

            // Return validation result
            return {
                valid: errors.length === 0,
                errors,
                appliedRules,
                timestamp: new Date().toISOString(),
                validator: 'DonationValidator.v1'
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Validation error: ${error.message}`],
                appliedRules: [],
                timestamp: new Date().toISOString(),
                validator: 'DonationValidator.v1'
            };
        }
    }

    /**
     * Validate amount is within acceptable range
     */
    validateAmount(amount) {
        return amount >= this.MIN_DONATION_AMOUNT && amount <= this.MAX_DONATION_AMOUNT;
    }

    /**
     * Validate charity percentages sum to 100
     */
    validatePercentages(charities) {
        const total = charities.reduce((sum, charity) => {
            return sum + (charity.percentage || 0);
        }, 0);

        // Allow small floating point errors
        return Math.abs(total - 100) < 0.01;
    }

    /**
     * Validate charity is registered and verified (async)
     * This would be called before the donation is created
     * 
     * @param {string} charityId - Charity ID to verify
     * @returns {Promise<boolean>}
     */
    async isVerifiedCharity(charityId) {
        try {
            const charity = await Charity.findById(charityId);
            return charity !== null; // In future, add: && charity.verified === true
        } catch (error) {
            console.error('[Validator] Error checking charity:', error.message);
            return false;
        }
    }

    /**
     * Validate all charities in a donation are verified (async)
     * Call this before creating the donation
     * 
     * @param {Array} charities - Array of charity objects
     * @returns {Promise<Object>} Validation result
     */
    async validateCharitiesVerified(charities) {
        const errors = [];
        const appliedRules = [];

        try {
            for (const charity of charities) {
                const charityId = charity._id || charity.charityId;
                const isVerified = await this.isVerifiedCharity(charityId);

                if (!isVerified) {
                    errors.push(`Charity ${charityId} is not verified`);
                }
            }

            if (errors.length === 0) {
                appliedRules.push('all_charities_verified');
            }

            return {
                valid: errors.length === 0,
                errors,
                appliedRules
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Charity verification error: ${error.message}`],
                appliedRules: []
            };
        }
    }

    /**
     * Validate distribution batch (for when funds are actually sent)
     * Mimics smart contract distribution validation
     * 
     * @param {Object} distributionData - Distribution batch data
     * @returns {Object} Validation result
     */
    validateDistribution(distributionData) {
        const errors = [];
        const appliedRules = [];

        try {
            // Validate batch has donations
            if (!distributionData.donations || distributionData.donations.length === 0) {
                errors.push('Distribution batch must contain at least one donation');
            } else {
                appliedRules.push('batch_has_donations');
            }

            // Validate charities and amounts match
            if (distributionData.charities.length !== distributionData.amounts.length) {
                errors.push('Charities and amounts arrays must have same length');
            } else {
                appliedRules.push('charities_amounts_match');
            }

            // Validate all amounts are positive
            const negativeAmounts = distributionData.amounts.filter(amt => amt <= 0);
            if (negativeAmounts.length > 0) {
                errors.push('All distribution amounts must be positive');
            } else {
                appliedRules.push('amounts_positive');
            }

            return {
                valid: errors.length === 0,
                errors,
                appliedRules,
                timestamp: new Date().toISOString(),
                validator: 'DonationValidator.v1'
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Distribution validation error: ${error.message}`],
                appliedRules: [],
                timestamp: new Date().toISOString(),
                validator: 'DonationValidator.v1'
            };
        }
    }
}

// Export singleton instance
module.exports = new DonationValidator();
