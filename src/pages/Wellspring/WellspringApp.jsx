import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Filter, Plus, Search, ShieldAlert, Sparkles, FileText, Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../auth/AuthContext';
import {
  getDonations,
  getDistributions,
  getInventory,
  getWellspringMongoSummary,
  postDistribution,
  postDonation
} from '../../services/wellspringApi';

const programs = [
  'Nutritious Meals Program',
  "Women's Wellness / Safety Net Services",
  'Art of Being Program',
  "Children's Corner"
];
const programOptions = [
  { value: 'all', label: 'All Programs' },
  { value: 'Nutritious Meals Program', label: 'Meals Program' },
  { value: "Women's Wellness / Safety Net Services", label: 'Wellness Program' },
  { value: 'Art of Being Program', label: 'Art Program' },
  { value: "Children's Corner", label: "Child Care Program" }
];
const categories = [
  'Food & Beverages',
  'Kitchen & Dining Supplies',
  'Hygiene & Toiletries',
  'Menstrual Care',
  'Dental Care',
  'Clothing & Apparel',
  'Medical & Care Supplies',
  'Gift Cards & Transportation',
  'Baby Care',
  'Art & Creative Supplies'
];
const donationCategoryOptions = ['Money', ...categories];
const subCategories = {
  'Food & Beverages': ['Tea', 'Honey', 'Fruit Juice', 'Cream Cheese', 'Yogurt', 'Olive Oil', 'Canola Oil', 'Ground Coffee', 'Sugar', 'Sweetener Packets', 'Creamer', 'Jams', 'Jellies', 'Oatmeal', 'Cereal', 'Baby Formula'],
  'Kitchen & Dining Supplies': ['Plastic Utensils', 'Compostable Utensils', 'Paper Towels', 'Toilet Paper', 'Coffee Stirrers'],
  'Hygiene & Toiletries': ['Soap', 'Shampoo', 'Conditioner', 'Lotion', 'Deodorant', 'Travel-size Toiletries', 'Small Tissue Packets'],
  'Menstrual Care': ['Menstrual Pads', 'Menstrual Cups', 'Tampons'],
  'Dental Care': ['Toothbrushes', 'Toothpaste'],
  'Clothing & Apparel': ["Women's Underwear", 'Sweat Pants', 'Baby Onesies', 'Baby Bibs'],
  'Medical & Care Supplies': ['Adult Pull-up Diapers', 'Bed Pads', 'Disposable Diapers'],
  'Gift Cards & Transportation': ['Grocery Gift Cards', 'Gas Cards', 'Bus Cards'],
  'Baby Care': ['Baby Wash', 'Baby Lotion', 'Baby Bottles', 'Sippy Cups'],
  'Art & Creative Supplies': ['Yarn', 'Garment Fabric', 'Mixed Media Paper', 'Watercolor Paper', 'Sketchbooks', 'Drawing Pencils', 'Sharpeners', 'Erasers', 'Adult Coloring Books', 'Fine Point Markers', 'Art Supply Gift Cards']
};
const nonAcceptableItems = [
  "Used Adult Clothing","Used Children's Clothing","Used Undergarments","Used Shoes","Used Breast Pumps","Cribs","Car Seats","High Chairs","Pack-and-Plays","Used Toys","Soiled Toys","Used Games","Soiled Games","Used Books","Soiled Books","Expired Medications","Used Medications","New Medications","Oral Medications","Topical Medications","Supplements","Expired Food","Opened Food Items","Pesticides","Paint","Paint Thinner","Drain Cleaner","Oven Cleaner","Aerosols","Hazardous Household Chemicals","Used Appliances","TVs","Furniture","Bed Frames","Box Springs","Mattresses","Computer Monitors","Decorative Household Items","Stereos","Household Appliances","Tires","Lead Acid Batteries","Automotive Additives","Gasoline","Antifreeze","Automotive Hazardous Waste","Used Shampoo","Used Conditioner","Old Nail Polish Remover","Rusted Shaving Cream Bottles","Used Hairspray","Used Shavers","Personal Curling Irons","Used Brushes","Used Combs","Plumbing Fixtures","Building Materials","Carpet","Carpet Padding"
];

const chartColors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#6B7280', '#EC4899', '#14B8A6', '#84CC16', '#F97316'];
const createInitialInventoryFilters = () => ({
  program: [],
  category: [],
  subCategory: [],
  quantity: '',
  expirationDate: ''
});
const todayISO = () => new Date().toISOString().slice(0, 10);

function isExpired(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateValue);
  exp.setHours(0, 0, 0, 0);
  return exp < today;
}
function normalizeItemName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function singularizeWord(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}
function normalizeForCompare(value) {
  return normalizeItemName(value)
    .split(' ')
    .map((w) => singularizeWord(w))
    .join(' ');
}
const nonAcceptableNormalized = new Set(
  nonAcceptableItems.flatMap((item) => [normalizeItemName(item), normalizeForCompare(item)])
);
function isNonAcceptableName(value) {
  const raw = normalizeItemName(value);
  const singular = normalizeForCompare(value);
  return nonAcceptableNormalized.has(raw) || nonAcceptableNormalized.has(singular);
}

function statusOf(quantity) {
  if (quantity <= 0) return 'Out';
  if (quantity <= 8) return 'Low';
  return 'In Stock';
}
function programShortLabel(programName) {
  if (programName === 'Nutritious Meals Program') return 'Meals Program';
  if (programName === "Women's Wellness / Safety Net Services") return 'Wellness';
  if (programName === 'Art of Being Program') return 'Art Program';
  if (programName === "Children's Corner") return "Children's Corner";
  return programName;
}

function getProgramLabel(programValue) {
  return programOptions.find((option) => option.value === programValue)?.label || programValue;
}

function applyInventoryFilters(rows, filters) {
  let nextRows = [...rows];

  if (filters.program && filters.program.length) {
    nextRows = nextRows.filter((row) => filters.program.includes(row.program));
  }
  if (filters.category && filters.category.length) {
    nextRows = nextRows.filter((row) => filters.category.includes(row.category));
  }
  if (filters.subCategory && filters.subCategory.length) {
    nextRows = nextRows.filter((row) => filters.subCategory.includes(row.subCategory));
  }
  if (filters.quantity) {
    nextRows = [...nextRows].sort((a, b) => (filters.quantity === 'High to Low' ? b.quantity - a.quantity : a.quantity - b.quantity));
  }
  if (filters.expirationDate) {
    nextRows = [...nextRows].sort((a, b) => {
      const da = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      return filters.expirationDate === 'Earliest to Latest' ? da - db : db - da;
    });
  }

  return [...nextRows].sort((a, b) => {
    const aOut = a.quantity <= 0 ? 1 : 0;
    const bOut = b.quantity <= 0 ? 1 : 0;
    return aOut - bOut;
  });
}

function getInventoryFilterOptions(filterKey) {
  if (filterKey === 'program') return programs;
  if (filterKey === 'category') return categories;
  if (filterKey === 'subCategory') return [...new Set(categories.flatMap((c) => subCategories[c] || []))];
  if (filterKey === 'quantity') return ['High to Low', 'Low to High'];
  return ['Earliest to Latest', 'Latest to Earliest'];
}

function MultiSelectFilterSection({ filterKey, label, filters, setFilters }) {
  const selected = filters[filterKey] || [];
  const options =
    filterKey === 'subCategory'
      ? (
          filters.category && filters.category.length
            ? [...new Set(filters.category.flatMap((c) => subCategories[c] || []))]
            : getInventoryFilterOptions('subCategory')
        )
      : getInventoryFilterOptions(filterKey);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-gray-800">{label}</p>
      <details className="group">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800">
          <span className="truncate">
            {selected.length ? `${selected.length} selected` : `Select ${label}`}
          </span>
          <span className="text-gray-500">▼</span>
        </summary>
        <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="mb-1 grid min-h-11 grid-cols-[20px_1fr] items-start gap-3 rounded px-2 py-2 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setFilters((prev) => {
                      const prevValues = prev[filterKey] || [];
                      return {
                        ...prev,
                        [filterKey]: e.target.checked
                          ? [...prevValues, opt]
                          : prevValues.filter((v) => v !== opt)
                      };
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="leading-6 text-gray-900">{opt}</span>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function SingleSelectFilterSection({ filterKey, label, filters, setFilters }) {
  const selected = filters[filterKey] || '';
  const options = getInventoryFilterOptions(filterKey);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-gray-800">{label}</p>
      <select
        value={selected}
        onChange={(e) => setFilters((prev) => ({ ...prev, [filterKey]: e.target.value }))}
        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"
      >
        <option value="">Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function WellspringApp() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [errors, setErrors] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const reportRef = React.useRef(null);
  const syncErrorToastShown = useRef(false);

  const [inventory, setInventory] = useState([]);
  const [donations, setDonations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [wellspringMoney, setWellspringMoney] = useState({ totalCollected: 0, transactionCount: 0, latestDonationAt: null });
  const [reportProgram, setReportProgram] = useState('all');
  const [reportDuration, setReportDuration] = useState('monthly');
  const [reportMode, setReportMode] = useState('both');
  const [reportSections, setReportSections] = useState({
    inventoryByCategory: true,
    statsByProgram: true,
    trend: true,
    donors: true,
    distributors: true,
    inventoryByStatus: true
  });
  const [reportInventoryFilters, setReportInventoryFilters] = useState(createInitialInventoryFilters());

  const [draftFilters, setDraftFilters] = useState(createInitialInventoryFilters());
  const [appliedFilters, setAppliedFilters] = useState(createInitialInventoryFilters());
  const [distribution, setDistribution] = useState({ itemId: '', quantity: 1, program: programs[0], dateDistributed: todayISO() });
  const [expandedDistributionId, setExpandedDistributionId] = useState('');
  const [donation, setDonation] = useState({
    donor: '',
    dateReceived: todayISO(),
    category: '',
    subCategory: '',
    itemName: '',
    amount: '',
    quantity: 1,
    condition: 'new',
    expirationDate: '',
    program: '',
    notes: ''
  });
  const enteredItemName = donation.itemName.trim();
  const isProhibitedItemEntry =
    donation.category !== 'Money' &&
    enteredItemName.length > 0 &&
    isNonAcceptableName(enteredItemName);
  const donationSubCategoryOptions = useMemo(
    () =>
      donation.category && donation.category !== 'Money'
        ? (subCategories[donation.category] || [])
        : [],
    [donation.category]
  );

  useEffect(() => {
    const allowedSubCategories =
      draftFilters.category && draftFilters.category.length
        ? [...new Set(draftFilters.category.flatMap((c) => subCategories[c] || []))]
        : getInventoryFilterOptions('subCategory');

    setDraftFilters((prev) => {
      const valid = (prev.subCategory || []).filter((s) => allowedSubCategories.includes(s));
      if (valid.length === (prev.subCategory || []).length) return prev;
      return { ...prev, subCategory: valid };
    });
  }, [draftFilters.category]);

  useEffect(() => {
    if (!donation.subCategory) return;
    if (!donationSubCategoryOptions.includes(donation.subCategory)) {
      setDonation((prev) => ({ ...prev, subCategory: '' }));
    }
  }, [donation.subCategory, donationSubCategoryOptions]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const fetchAll = useCallback(async (searchTerm = '') => {
    try {
      const [invRes, donationRes, distRes, moneyRes] = await Promise.all([
        getInventory(searchTerm),
        getDonations(),
        getDistributions(),
        getWellspringMongoSummary()
      ]);

      const mapped = (invRes || []).map((x) => ({
        id: x.id || x._id,
        itemName: x.itemName,
        category: x.category || '',
        subCategory: x.subCategory || 'General',
        program: x.destinationProgram || 'Unassigned',
        donor: x.donor || 'Anonymous',
        quantity: Number(x.currentQuantity || 0),
        condition: x.condition || 'new',
        expirationDate: x.expirationDate || '',
        dateAdded: x.dateAdded || ''
      }));

      setInventory(mapped);
      setDonations(donationRes || []);
      setDistributions(distRes || []);
      setWellspringMoney({
        totalCollected: Number(moneyRes?.totalCollected || 0),
        transactionCount: Number(moneyRes?.transactionCount || 0),
        latestDonationAt: moneyRes?.latestDonationAt || null
      });
      syncErrorToastShown.current = false;
    } catch (e) {
      if (!syncErrorToastShown.current) {
        showToast(e.message || 'Could not sync Wellspring data.');
        syncErrorToastShown.current = true;
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAll(query);
    }, 250);
    const id = setInterval(() => fetchAll(query), 3000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(id);
    };
  }, [fetchAll, query]);

  const filteredInventory = useMemo(() => {
    return applyInventoryFilters(inventory, appliedFilters);
  }, [inventory, appliedFilters]);

  const getDurationStart = (duration) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (duration === 'today') return start;
    if (duration === 'weekly') start.setDate(start.getDate() - 7);
    if (duration === 'monthly') start.setMonth(start.getMonth() - 1);
    if (duration === 'quarterly') start.setMonth(start.getMonth() - 3);
    if (duration === 'yearly') start.setFullYear(start.getFullYear() - 1);
    return start;
  };
  const isInReportRange = (dateLike, startDate) => {
    if (!dateLike) return false;
    const dt = new Date(dateLike);
    return !Number.isNaN(dt.getTime()) && dt >= startDate;
  };

  const reportSummary = useMemo(() => {
    const startDate = getDurationStart(reportDuration);
    const byProgram = (program) => reportProgram === 'all' || (program || 'Unassigned') === reportProgram;
    const includeDonation = reportMode !== 'distribution';
    const includeDistribution = reportMode !== 'donation';

    const allDonationRows = (donations || []).filter((d) =>
      byProgram(d.destinationProgram || d.program) &&
      isInReportRange(d.dateReceived || d.createdAt, startDate)
    );
    const allDistributionRows = (distributions || []).filter((d) =>
      byProgram(d.program) &&
      isInReportRange(d.dateDistributed || d.createdAt, startDate)
    );
    const donationRows = includeDonation ? allDonationRows : [];
    const distributionRows = includeDistribution ? allDistributionRows : [];
    const inventoryRows = (inventory || []).filter((i) => {
      if (!byProgram(i.program)) return false;
      if (!i.dateAdded) return true;
      return isInReportRange(i.dateAdded, startDate);
    });

    const filteredInventoryRows = applyInventoryFilters(inventoryRows, reportInventoryFilters);

    const totalDonations = donationRows.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
    const totalDistributions = distributionRows.reduce((sum, d) => sum + Number(d.quantityDistributed || 0), 0);

    return {
      inventoryRows: filteredInventoryRows,
      donationRows,
      distributionRows,
      totalDonations,
      totalDistributions
    };
  }, [donations, distributions, inventory, reportProgram, reportDuration, reportMode, reportInventoryFilters]);

  const reportInventoryRows = useMemo(() => reportSummary.inventoryRows, [reportSummary.inventoryRows]);

  const categoryChartData = useMemo(() => (
    categories
      .map((c) => ({
        name: c,
        value: reportInventoryRows
          .filter((i) => i.category === c)
          .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
      }))
      .filter((x) => x.value > 0)
  ), [reportInventoryRows]);

  const programStatsData = useMemo(() => (
    programs.map((program) => ({
      name: programShortLabel(program),
      donationCount: reportSummary.donationRows.filter((d) => (d.destinationProgram || d.program || 'Unassigned') === program).length,
      distributionCount: reportSummary.distributionRows.filter((d) => (d.program || 'Unassigned') === program).length
    }))
  ), [reportSummary.donationRows, reportSummary.distributionRows]);

  const topDonors = useMemo(() => (
    Object.entries(
      reportSummary.donationRows.reduce((acc, d) => {
        const donor = d.donorName || 'Anonymous';
        acc[donor] = (acc[donor] || 0) + Number(d.quantity || 0);
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  ), [reportSummary.donationRows]);

  const topDistributors = useMemo(() => (
    Object.entries(
      reportSummary.distributionRows.reduce((acc, d) => {
        const distributor = d.distributedBy || 'Unknown';
        acc[distributor] = (acc[distributor] || 0) + Number(d.quantityDistributed || 0);
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  ), [reportSummary.distributionRows]);

  const statusChartData = useMemo(() => {
    const byStatus = reportInventoryRows.reduce((acc, item) => {
      const status = statusOf(Number(item.quantity || 0));
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    return ['In Stock', 'Low', 'Out']
      .map((name) => ({ name, value: byStatus[name] || 0 }))
      .filter((x) => x.value > 0);
  }, [reportInventoryRows]);

  const trendData = useMemo(() => {
    const nowDate = new Date();
    const addCount = (arr, dateValue, field) => {
      const dt = new Date(dateValue);
      const hit = arr.find((x) => dt >= x.start && dt < x.end);
      if (hit) hit[field] += 1;
    };
    const buckets = [];

    if (reportDuration === 'today') {
      for (let hour = 0; hour < 24; hour += 4) {
        const start = new Date(nowDate);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(hour + 4, 0, 0, 0);
        buckets.push({ label: `${String(hour).padStart(2, '0')}:00`, start, end, donationCount: 0, distributionCount: 0 });
      }
    } else if (reportDuration === 'weekly') {
      const start = getDurationStart('weekly');
      for (let i = 0; i < 7; i += 1) {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        buckets.push({ label: dayStart.toLocaleDateString(undefined, { weekday: 'short' }), start: dayStart, end: dayEnd, donationCount: 0, distributionCount: 0 });
      }
    } else if (reportDuration === 'monthly') {
      const start = getDurationStart('monthly');
      for (let i = 0; i < 5; i += 1) {
        const partStart = new Date(start);
        partStart.setDate(start.getDate() + i * 6);
        const partEnd = new Date(partStart);
        partEnd.setDate(partStart.getDate() + 6);
        buckets.push({ label: `W${i + 1}`, start: partStart, end: partEnd, donationCount: 0, distributionCount: 0 });
      }
    } else if (reportDuration === 'quarterly') {
      const start = getDurationStart('quarterly');
      for (let i = 0; i < 3; i += 1) {
        const monthStart = new Date(start);
        monthStart.setMonth(start.getMonth() + i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        buckets.push({ label: monthStart.toLocaleDateString(undefined, { month: 'short' }), start: monthStart, end: monthEnd, donationCount: 0, distributionCount: 0 });
      }
    } else {
      const start = getDurationStart('yearly');
      for (let i = 0; i < 12; i += 1) {
        const monthStart = new Date(start);
        monthStart.setMonth(start.getMonth() + i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        buckets.push({ label: monthStart.toLocaleDateString(undefined, { month: 'short' }), start: monthStart, end: monthEnd, donationCount: 0, distributionCount: 0 });
      }
    }

    reportSummary.donationRows.forEach((d) => addCount(buckets, d.dateReceived || d.createdAt, 'donationCount'));
    reportSummary.distributionRows.forEach((d) => addCount(buckets, d.dateDistributed || d.createdAt, 'distributionCount'));
    return buckets.map(({ label, donationCount, distributionCount }) => ({ label, donationCount, distributionCount }));
  }, [reportDuration, reportSummary.donationRows, reportSummary.distributionRows]);

  const handleExportAdvancedReport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    showToast('Generating high-quality PDF report...');
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let remainingHeight = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        remainingHeight -= pageHeight;
      }
      pdf.save(`Wellspring_Advanced_Report_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('Report downloaded successfully.');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('Failed to generate PDF report.');
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const addDonation = async () => {
    const isMoneyCategory = donation.category === 'Money';
    const amountValue = Number(donation.amount || 0);
    const nextErrors = [];
    if (!donation.category) nextErrors.push('Category is required.');
    if (!donation.dateReceived) nextErrors.push('Date is required.');
    if (isMoneyCategory) {
      if (!amountValue || amountValue <= 0) nextErrors.push('Amount must be greater than 0.');
    } else {
      if (!donation.itemName.trim()) nextErrors.push('Item name is required.');
      if (!donation.quantity || donation.quantity < 1) nextErrors.push('Quantity must be at least 1.');
      if (isNonAcceptableName(donation.itemName.trim())) {
        nextErrors.push(`"${donation.itemName.trim()}" is prohibited. See full prohibited-items list below.`);
      }
    }
    if (donation.category === 'Food & Beverages' && !donation.expirationDate) nextErrors.push('Expiration date is required for Food & Beverages.');
    if (donation.expirationDate && isExpired(donation.expirationDate)) nextErrors.push('Expiration date cannot be in the past.');
    setErrors(nextErrors);
    if (nextErrors.length) return;

    try {
      const res = await postDonation({
        donorName: donation.donor || 'Anonymous',
        dateReceived: donation.dateReceived,
        category: donation.category,
        subCategory: isMoneyCategory ? 'Monetary Donation' : donation.subCategory || 'General',
        itemName: isMoneyCategory ? 'Monetary Donation' : donation.itemName.trim(),
        amount: isMoneyCategory ? amountValue : undefined,
        quantity: isMoneyCategory ? amountValue : donation.quantity,
        condition: isMoneyCategory ? 'new' : donation.condition,
        expirationDate: donation.expirationDate,
        destinationProgram: donation.program || 'Unassigned',
        notes: donation.notes
      });
      if (res?.error) {
        if (Array.isArray(res.prohibitedItems) && res.prohibitedItems.length) {
          setErrors([res.error, `Prohibited items: ${res.prohibitedItems.join(', ')}`]);
        } else {
          setErrors([res.error]);
        }
        return;
      }
      await fetchAll(query);
      setDonation({
        donor: '',
        dateReceived: todayISO(),
        category: '',
        subCategory: '',
        itemName: '',
        amount: '',
        quantity: 1,
        condition: 'new',
        expirationDate: '',
        program: '',
        notes: ''
      });
      setErrors([]);
      showToast('Donation added successfully.');
      setShowDonationModal(false);
    } catch (e) {
      setErrors(['Failed to add donation.']);
    }
  };

  const distributeItem = async () => {
    const item = inventory.find((i) => i.id === distribution.itemId);
    const nextErrors = [];
    if (!item) nextErrors.push('Select an item.');
    if (!distribution.quantity || distribution.quantity < 1) nextErrors.push('Quantity must be at least 1.');
    if (item && distribution.quantity > item.quantity) nextErrors.push(`Requested ${distribution.quantity} but only ${item.quantity} available.`);
    if (item && isExpired(item.expirationDate)) nextErrors.push('Cannot distribute expired item.');
    setErrors(nextErrors);
    if (nextErrors.length) return;

    try {
      const res = await postDistribution({
        itemId: distribution.itemId,
        quantityDistributed: distribution.quantity,
        program: distribution.program,
        dateDistributed: distribution.dateDistributed
      });
      if (res?.error) {
        setErrors([res.error]);
        return;
      }
      await fetchAll(query);
      setDistribution({ ...distribution, itemId: '', quantity: 1, dateDistributed: todayISO() });
      setExpandedDistributionId('');
      setErrors([]);
      showToast('Distribution recorded.');
    } catch (e) {
      setErrors(['Failed to distribute item.']);
    }
  };

  const adminDisplayName = user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Wellspring admin';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-30 w-full bg-[#FCF8F1] shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Charitap Logo" className="h-9 w-auto" />
            <div>
              <p className="text-lg font-bold text-gray-900">Charitap Admin</p>
              <p className="text-xs text-gray-700">Wellspring Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-green-200 bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-900 lg:inline-flex">
              charitaps collected: ${wellspringMoney.totalCollected.toFixed(2)}
            </span>
            <button onClick={() => setPage('dashboard')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${page === 'dashboard' ? 'border-yellow-500 text-gray-950' : 'border-transparent text-gray-700 hover:text-gray-950'}`}>Dashboard</button>
            <button onClick={() => setPage('reports')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${page === 'reports' ? 'border-yellow-500 text-gray-950' : 'border-transparent text-gray-700 hover:text-gray-950'}`}>Reports</button>
            <button onClick={logout} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline text-gray-900">Wellspring Admin</h1>
            <p className="text-body text-gray-700">Inventory, distributions, and Wellspring charity performance in one place. Signed in as {adminDisplayName}.</p>
          </div>
          {page === 'dashboard' && (
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-3 text-gray-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inventory, donors, or categories"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm"
              />
            </div>
          )}
        </div>

        {!!errors.length && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.join(' ')}
          </div>
        )}

        {page === 'dashboard' && (
          <>
            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
	              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
	                <div>
	                  <h2 className="text-xl font-semibold text-gray-900">Complete Inventory</h2>
	                  
	                </div>
	                <button onClick={() => setShowDonationModal(true)} className="inline-flex items-center rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-500">
	                  <Plus size={14} className="mr-1" />New Donation
	                </button>
	              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[290px_1fr]">
                <aside className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Filter size={16} className="text-gray-500" />
                      Filters
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const reset = createInitialInventoryFilters();
                        setDraftFilters(reset);
                        setAppliedFilters(reset);
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-3">
                    <MultiSelectFilterSection filterKey="program" label="Program" filters={draftFilters} setFilters={setDraftFilters} />
                    <MultiSelectFilterSection filterKey="category" label="Category" filters={draftFilters} setFilters={setDraftFilters} />
                    <MultiSelectFilterSection filterKey="subCategory" label="Sub Category" filters={draftFilters} setFilters={setDraftFilters} />
                    <SingleSelectFilterSection filterKey="quantity" label="Quantity" filters={draftFilters} setFilters={setDraftFilters} />
                    <SingleSelectFilterSection filterKey="expirationDate" label="Expiration Date" filters={draftFilters} setFilters={setDraftFilters} />
                    <button
                      type="button"
                      onClick={() => setAppliedFilters(JSON.parse(JSON.stringify(draftFilters)))}
                      className="mt-2 h-10 w-full rounded-lg bg-black text-sm font-semibold text-white hover:bg-gray-900"
                    >
                      Apply
                    </button>
                  </div>
                </aside>

                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {appliedFilters.program.map((v) => <span key={`program-${v}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Program: {v}</span>)}
                    {appliedFilters.category.map((v) => <span key={`category-${v}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Category: {v}</span>)}
                    {appliedFilters.subCategory.map((v) => <span key={`subcategory-${v}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Sub Category: {v}</span>)}
                    {appliedFilters.quantity ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Quantity: {appliedFilters.quantity}</span> : null}
                    {appliedFilters.expirationDate ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Expiration Date: {appliedFilters.expirationDate}</span> : null}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Item Name</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Sub Category</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Program</th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700">Qty</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Condition</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700">Expiration</th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700">Status</th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
	                    {filteredInventory.map((item) => {
	                      const status = statusOf(item.quantity);
	                      const isExpanded = expandedDistributionId === item.id;
	                      return (
	                        <React.Fragment key={item.id}>
	                          <tr className="hover:bg-gray-50">
	                            <td className="px-3 py-3 font-medium text-gray-900">{item.itemName}</td>
	                            <td className="px-3 py-3 text-gray-700">{item.category}</td>
	                            <td className="px-3 py-3 text-gray-700">{item.subCategory}</td>
	                            <td className="px-3 py-3 text-gray-700">{item.program}</td>
	                            <td className="px-3 py-3 text-center font-semibold text-gray-900">{item.quantity}</td>
	                            <td className="px-3 py-3 capitalize text-gray-700">{item.condition}</td>
	                            <td className="px-3 py-3 text-gray-700">{item.expirationDate || 'N/A'}</td>
	                            <td className="px-3 py-3 text-center">
	                              <span className={`inline-flex min-w-[78px] justify-center rounded-full px-2 py-1 text-xs font-semibold ${
	                                status === 'In Stock'
	                                  ? 'bg-green-100 text-green-800'
	                                  : status === 'Low'
	                                    ? 'bg-yellow-100 text-yellow-800'
	                                    : 'bg-red-100 text-red-700'
	                              }`}>
	                                {status}
	                              </span>
	                            </td>
	                            <td className="px-3 py-3 text-center">
	                              <button
	                                type="button"
	                                onClick={() => {
	                                  if (isExpanded) {
	                                    setExpandedDistributionId('');
	                                    return;
	                                  }
	                                  setExpandedDistributionId(item.id);
	                                  setDistribution({
	                                    itemId: item.id,
	                                    quantity: 1,
	                                    program: item.program || programs[0],
	                                    dateDistributed: todayISO()
	                                  });
	                                }}
	                                disabled={item.quantity <= 0}
	                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${item.quantity <= 0 ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : isExpanded ? 'border-yellow-400 bg-yellow-50 text-yellow-900' : 'border-gray-300 bg-white text-gray-800 hover:border-yellow-400 hover:bg-yellow-50'}`}
	                              >
	                                Distribute
	                              </button>
	                            </td>
	                          </tr>
	                          {isExpanded && (
	                            <tr>
	                              <td colSpan={9} className="bg-yellow-50/50 px-4 py-4">
	                                <div className="rounded-xl border border-yellow-200 bg-white p-4 shadow-sm">
	                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
	                                    <div>
	                                      <h3 className="font-semibold text-gray-900">Distribute {item.itemName}</h3>
	                                      <p className="text-xs text-gray-600">Available: {item.quantity} {item.expirationDate ? `| Expiration: ${item.expirationDate}` : '| No expiration date'}</p>
	                                    </div>
	                                    <button type="button" onClick={() => setExpandedDistributionId('')} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
	                                  </div>
	                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
	                                    <Field label="Quantity">
	                                      <Input
	                                        type="number"
	                                        min={1}
	                                        max={item.quantity}
	                                        value={String(distribution.quantity)}
	                                        onChange={(e) => setDistribution({ ...distribution, quantity: Number(e.target.value) })}
	                                      />
	                                    </Field>
	                                    <Field label="Program">
	                                      <Select value={distribution.program} onChange={(e) => setDistribution({ ...distribution, program: e.target.value })} options={programs} />
	                                    </Field>
	                                    <Field label="Date">
	                                      <Input type="date" value={distribution.dateDistributed} onChange={(e) => setDistribution({ ...distribution, dateDistributed: e.target.value })} />
	                                    </Field>
	                                  </div>
	                                  <div className="mt-4 flex justify-end">
	                                    <button type="button" onClick={distributeItem} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900">
	                                      Confirm Distribution
	                                    </button>
	                                  </div>
	                                </div>
	                              </td>
	                            </tr>
	                          )}
	                        </React.Fragment>
	                      );
	                    })}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {showDonationModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
          <section className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="mb-1 text-xl font-semibold text-gray-900">Add Donation</h2>
                <p className="text-sm text-gray-500">Accepted items only. Validation checks non-acceptable and expired entries.</p>
              </div>
              <button type="button" onClick={() => setShowDonationModal(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Close donation form">
                <X size={18} />
              </button>
            </div>
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"><Sparkles className="mr-1 inline" size={14} /> Use program destination to reduce manual distribution work.</div>
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800"><ShieldAlert className="mr-1 inline" size={14} /> Items from the restricted list are blocked automatically.</div>
            {isProhibitedItemEntry ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold">
                  <ShieldAlert className="mr-1 inline" size={14} />
                  {` "${enteredItemName}" is prohibited and cannot be accepted.`}
                </p>
                <p className="mt-1 text-red-700">Prohibited items:</p>
                <div className="mt-2 max-h-44 overflow-auto rounded-md border border-red-200 bg-white p-2 text-xs leading-5 text-red-800">
                  {nonAcceptableItems.join(', ')}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Donor Name"><Input value={donation.donor} onChange={(e) => setDonation({ ...donation, donor: e.target.value })} /></Field>
              <Field label="Date *"><Input type="date" value={donation.dateReceived} onChange={(e) => setDonation({ ...donation, dateReceived: e.target.value })} /></Field>
              <Field label="Category *"><Select value={donation.category} onChange={(e) => setDonation({ ...donation, category: e.target.value, subCategory: '' })} options={['', ...donationCategoryOptions]} /></Field>
              {donation.category === 'Money' ? (
                <Field label="Amount *">
                  <Input type="number" min={0.01} step="0.01" value={String(donation.amount)} onChange={(e) => setDonation({ ...donation, amount: e.target.value })} />
                </Field>
              ) : (
                <>
                  <Field label="Sub Category">
                    <Select
                      value={donation.subCategory}
                      onChange={(e) => setDonation({ ...donation, subCategory: e.target.value })}
                      options={['', ...donationSubCategoryOptions]}
                      disabled={!donation.category}
                    />
                  </Field>
                  <Field label="Item Name *"><Input value={donation.itemName} onChange={(e) => setDonation({ ...donation, itemName: e.target.value })} /></Field>
                  <Field label="Quantity *"><Input type="number" min={1} value={String(donation.quantity)} onChange={(e) => setDonation({ ...donation, quantity: Number(e.target.value) })} /></Field>
                  <Field label="Condition *"><Select value={donation.condition} onChange={(e) => setDonation({ ...donation, condition: e.target.value })} options={['new', 'good', 'fair']} /></Field>
                </>
              )}
              <Field label={donation.category === 'Food & Beverages' ? 'Expiration Date *' : 'Expiration Date'}><Input type="date" value={donation.expirationDate} onChange={(e) => setDonation({ ...donation, expirationDate: e.target.value })} /></Field>
              <Field label="Program Destination"><Select value={donation.program} onChange={(e) => setDonation({ ...donation, program: e.target.value })} options={['', ...programs]} /></Field>
            </div>
            <Field label="Notes"><textarea rows={3} className="h-auto w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={donation.notes} onChange={(e) => setDonation({ ...donation, notes: e.target.value })} /></Field>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={addDonation} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900">Submit Donation</button>
            </div>
          </section>
          </div>
        )}

        {page === 'reports' && (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm h-fit sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="text-yellow-600" size={20} />
                <h3 className="text-lg font-bold text-gray-900">Report Filters</h3>
              </div>
              <div className="space-y-4">
                <Field label="Program Selection">
                  <Select value={reportProgram} onChange={(e) => setReportProgram(e.target.value)} options={programOptions.map(o => `${o.value}|${o.label}`)} formatter={o => o.split('|')[1]} />
                </Field>
                <Field label="Time Duration">
                  <Select
                    value={reportDuration}
                    onChange={(e) => setReportDuration(e.target.value)}
                    options={['today', 'weekly', 'monthly', 'quarterly', 'yearly']}
                    formatter={(o) => o.charAt(0).toUpperCase() + o.slice(1)}
                  />
                </Field>
                <Field label="Report Type">
                  <Select
                    value={reportMode}
                    onChange={(e) => setReportMode(e.target.value)}
                    options={['both', 'donation', 'distribution']}
                    formatter={(o) => o === 'both' ? 'Donation and Distribution' : o === 'donation' ? 'Donation Only' : 'Distribution Only'}
                  />
                </Field>
              </div>
              <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">Inventory Breakdown Filters</h4>
                  <button
                    type="button"
                    onClick={() => setReportInventoryFilters(createInitialInventoryFilters())}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  <MultiSelectFilterSection filterKey="category" label="Category" filters={reportInventoryFilters} setFilters={setReportInventoryFilters} />
                  <MultiSelectFilterSection filterKey="subCategory" label="Sub Category" filters={reportInventoryFilters} setFilters={setReportInventoryFilters} />
                  <SingleSelectFilterSection filterKey="quantity" label="Quantity" filters={reportInventoryFilters} setFilters={setReportInventoryFilters} />
                  <SingleSelectFilterSection filterKey="expirationDate" label="Expiration Date" filters={reportInventoryFilters} setFilters={setReportInventoryFilters} />
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowExportModal(true)} 
                disabled={isExporting}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50 transition-all shadow-md"
              >
                <Download size={16} />
                {isExporting ? 'Generating...' : 'Export Advanced Report'}
              </button>
            </aside>

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-6 lg:grid-cols-2">
              <div className="col-span-full rounded-2xl border border-gray-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Wellspring Impact Report</h2>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()} | Program: {getProgramLabel(reportProgram)}</p>
                    <p className="text-sm text-gray-500">Generated by {adminDisplayName} {user?.email ? `(${user.email})` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Duration: {reportDuration}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Mode: {reportMode === 'both' ? 'Donation and Distribution' : reportMode === 'donation' ? 'Donation Only' : 'Distribution Only'}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {reportInventoryFilters.category.length ? reportInventoryFilters.category.map((value) => <span key={`report-category-${value}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Category: {value}</span>) : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Category: All</span>}
                  {reportInventoryFilters.subCategory.length ? reportInventoryFilters.subCategory.map((value) => <span key={`report-subcategory-${value}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Sub Category: {value}</span>) : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Sub Category: All</span>}
                  {reportInventoryFilters.quantity ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Quantity: {reportInventoryFilters.quantity}</span> : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Quantity: Default</span>}
                  {reportInventoryFilters.expirationDate ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Expiration: {reportInventoryFilters.expirationDate}</span> : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Expiration: Default</span>}
                </div>
              </div>
              
              {reportSections.inventoryByCategory && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Inventory by Category</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 no-print">
                      <input type="checkbox" checked={reportSections.inventoryByCategory} onChange={(e) => setReportSections((prev) => ({ ...prev, inventoryByCategory: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryChartData} dataKey="value" cx="50%" cy="50%" outerRadius={96} label animationBegin={150} animationDuration={1200}>
                          {categoryChartData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportSections.statsByProgram && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Stats by Programs</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input type="checkbox" checked={reportSections.statsByProgram} onChange={(e) => setReportSections((prev) => ({ ...prev, statsByProgram: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={programStatsData} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} tickMargin={8} />
                        <YAxis type="category" dataKey="name" width={160} tickMargin={8} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="donationCount" name="Donations" fill="#F59E0B" radius={[0, 6, 6, 0]} animationBegin={100} animationDuration={1200} />
                        <Bar dataKey="distributionCount" name="Distributions" fill="#10B981" radius={[0, 6, 6, 0]} animationBegin={250} animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportSections.trend && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Donation vs Distribution Trend</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input type="checkbox" checked={reportSections.trend} onChange={(e) => setReportSections((prev) => ({ ...prev, trend: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="donationCount" name="Donations" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={100} animationDuration={1200} />
                        <Line type="monotone" dataKey="distributionCount" name="Distributions" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={200} animationDuration={1200} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportSections.inventoryByStatus && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Inventory by Status</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input type="checkbox" checked={reportSections.inventoryByStatus} onChange={(e) => setReportSections((prev) => ({ ...prev, inventoryByStatus: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" outerRadius={96} label animationBegin={200} animationDuration={1200}>
                          {statusChartData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={entry.name === 'In Stock' ? '#10B981' : entry.name === 'Low' ? '#F59E0B' : '#EF4444'}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportSections.donors && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Donors List</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input type="checkbox" checked={reportSections.donors} onChange={(e) => setReportSections((prev) => ({ ...prev, donors: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="space-y-2">
                    {topDonors.length ? (
                      topDonors.map(([name, qty], i) => (
                        <div key={name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <span className="text-sm text-gray-800">{i + 1}. {name}</span>
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">{qty} units</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No donors available for selected filters.</p>
                    )}
                  </div>
                </div>
              )}

              {reportSections.distributors && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Distributors List</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input type="checkbox" checked={reportSections.distributors} onChange={(e) => setReportSections((prev) => ({ ...prev, distributors: e.target.checked }))} />
                      Include
                    </label>
                  </div>
                  <div className="space-y-2">
                    {topDistributors.length ? (
                      topDistributors.map(([name, qty], i) => (
                        <div key={name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <span className="text-sm text-gray-800">{i + 1}. {name}</span>
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">{qty} units</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No distributors available for selected filters.</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </section>
        )}
      </main>

      <div
        ref={reportRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-[-20000px] top-0 w-[1280px] bg-white p-6 opacity-100"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="col-span-full rounded-2xl border border-gray-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Wellspring Impact Report</h2>
                <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()} | Program: {getProgramLabel(reportProgram)}</p>
                <p className="text-sm text-gray-500">Generated by {adminDisplayName} {user?.email ? `(${user.email})` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Duration: {reportDuration}</span>
                <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Mode: {reportMode === 'both' ? 'Donation and Distribution' : reportMode === 'donation' ? 'Donation Only' : 'Distribution Only'}</span>
                <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Inventory rows: {reportInventoryRows.length}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {reportInventoryFilters.category.length ? reportInventoryFilters.category.map((value) => <span key={`export-category-${value}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Category: {value}</span>) : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Category: All</span>}
              {reportInventoryFilters.subCategory.length ? reportInventoryFilters.subCategory.map((value) => <span key={`export-subcategory-${value}`} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Sub Category: {value}</span>) : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Sub Category: All</span>}
              {reportInventoryFilters.quantity ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Quantity: {reportInventoryFilters.quantity}</span> : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Quantity: Default</span>}
              {reportInventoryFilters.expirationDate ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">Expiration: {reportInventoryFilters.expirationDate}</span> : <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">Expiration: Default</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Donation rows</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{reportSummary.donationRows.length}</p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Distribution rows</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{reportSummary.distributionRows.length}</p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Donated units</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{reportSummary.totalDonations}</p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Distributed units</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{reportSummary.totalDistributions}</p>
              </div>
            </div>
          </div>

          <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Inventory Table</h3>
                <p className="text-sm text-gray-500">Dashboard inventory rows included in the exported report.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{reportInventoryRows.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Item Name</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Category</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Sub Category</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Program</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Qty</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Condition</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Expiration</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportInventoryRows.map((item) => {
                    const status = statusOf(item.quantity);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium text-gray-900">{item.itemName}</td>
                        <td className="px-3 py-3 text-gray-700">{item.category}</td>
                        <td className="px-3 py-3 text-gray-700">{item.subCategory}</td>
                        <td className="px-3 py-3 text-gray-700">{item.program}</td>
                        <td className="px-3 py-3 text-center font-semibold text-gray-900">{item.quantity}</td>
                        <td className="px-3 py-3 capitalize text-gray-700">{item.condition}</td>
                        <td className="px-3 py-3 text-gray-700">{item.expirationDate || 'N/A'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex min-w-[78px] justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                            status === 'In Stock'
                              ? 'bg-green-100 text-green-800'
                              : status === 'Low'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {reportSections.inventoryByCategory && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Inventory by Category</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryChartData} dataKey="value" cx="50%" cy="50%" outerRadius={96} label animationBegin={150} animationDuration={1200}>
                      {categoryChartData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportSections.statsByProgram && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Stats by Programs</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={programStatsData} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tickMargin={8} />
                    <YAxis type="category" dataKey="name" width={160} tickMargin={8} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="donationCount" name="Donations" fill="#F59E0B" radius={[0, 6, 6, 0]} animationBegin={100} animationDuration={1200} />
                    <Bar dataKey="distributionCount" name="Distributions" fill="#10B981" radius={[0, 6, 6, 0]} animationBegin={250} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportSections.trend && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Donation vs Distribution Trend</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="donationCount" name="Donations" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={100} animationDuration={1200} />
                    <Line type="monotone" dataKey="distributionCount" name="Distributions" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={200} animationDuration={1200} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportSections.inventoryByStatus && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Inventory by Status</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" outerRadius={96} label animationBegin={200} animationDuration={1200}>
                      {statusChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === 'In Stock' ? '#10B981' : entry.name === 'Low' ? '#F59E0B' : '#EF4444'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportSections.donors && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Donors List</h3>
              </div>
              <div className="space-y-2">
                {topDonors.length ? (
                  topDonors.map(([name, qty], i) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span className="text-sm text-gray-800">{i + 1}. {name}</span>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">{qty} units</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No donors available for selected filters.</p>
                )}
              </div>
            </div>
          )}

          {reportSections.distributors && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Distributors List</h3>
              </div>
              <div className="space-y-2">
                {topDistributors.length ? (
                  topDistributors.map(([name, qty], i) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span className="text-sm text-gray-800">{i + 1}. {name}</span>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">{qty} units</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No distributors available for selected filters.</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Export Advanced Report</h2>
              <button onClick={() => setShowExportModal(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <p className="mb-6 text-sm text-gray-600">
              Confirm the sections to include in your PDF report. The report will be generated as a high-resolution document suitable for presentation.
            </p>
            
            <div className="mb-6 space-y-3">
              {Object.entries({
                inventoryByCategory: 'Inventory by Category',
                statsByProgram: 'Stats by Program',
                trend: 'Donation/Distribution Trend',
                donors: 'Top Donors List',
                distributors: 'Top Distributors List',
                inventoryByStatus: 'Inventory Status Overview'
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={reportSections[key]} 
                    onChange={(e) => setReportSections(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleExportAdvancedReport}
                disabled={isExporting}
                className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-900 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm ${props.className || ''}`} />;
}

function Select({ options, formatter, ...props }) {
  return (
    <select {...props} className={`h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm ${props.className || ''}`}>
      {options.map((opt) => (
        <option key={opt} value={opt.includes('|') ? opt.split('|')[0] : opt}>
          {formatter ? formatter(opt) : opt || 'Select...'}
        </option>
      ))}
    </select>
  );
}
