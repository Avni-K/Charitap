/**
 * Export utilities for generating CSV and PDF from activity data
 * Updated to handle tab-specific exports (donated vs collected)
 */

// CSV Export for Donated Tab
export function exportDonatedCSV(activities, filename = 'charitap-donations.csv') {
  const headers = ['Date', 'Charity', 'Amount'];

  const rows = activities.map(activity => [
    new Date(activity.date).toLocaleString(),
    activity.charity,
    activity.amount
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CSV Export for Collected Tab
export function exportCollectedCSV(activities, filename = 'charitap-collected.csv') {
  const headers = ['Date', 'Purchase Amount', 'Round-Up Amount'];

  const rows = activities.map(activity => [
    new Date(activity.date).toLocaleString(),
    activity.purchaseAmount ? `$${parseFloat(activity.purchaseAmount).toFixed(2)}` : '-',
    activity.amount
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// PDF Export for Donated Tab
export function exportDonatedPDF(activities, filename = 'charitap-donations.pdf') {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Charitap Donation Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; border-bottom: 3px solid #FCD34D; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #FCD34D; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          .total { font-weight: bold; background-color: #FEF3C7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Charitap Donation Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Charity</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${activities.map(activity => `
              <tr>
                <td>${new Date(activity.date).toLocaleDateString()}</td>
                <td>${activity.charity}</td>
                <td>${activity.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="total">Total Transactions: ${activities.length}</p>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// PDF Export for Collected Tab
export function exportCollectedPDF(activities, filename = 'charitap-collected.pdf') {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Charitap Collection Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; border-bottom: 3px solid #FCD34D; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #FCD34D; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          .total { font-weight: bold; background-color: #FEF3C7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Charitap Collection Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Purchase Amount</th>
              <th>Round-Up Amount</th>
            </tr>
          </thead>
          <tbody>
            ${activities.map(activity => `
              <tr>
                <td>${new Date(activity.date).toLocaleDateString()}</td>
                <td>${activity.purchaseAmount ? `$${parseFloat(activity.purchaseAmount).toFixed(2)}` : '-'}</td>
                <td>${activity.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="total">Total Transactions: ${activities.length}</p>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// Legacy exports for backward compatibility (will be removed)
export function exportToCSV(activities, filename = 'charitap-export.csv') {
  const headers = ['Date', 'Type', 'Charity', 'Category', 'Amount'];

  const rows = activities.map(activity => [
    new Date(activity.date).toLocaleString(),
    activity.type === 'donation' ? 'Donation' : 'Round-Up Collection',
    activity.charity,
    activity.category,
    activity.amount
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(activities, filename = 'charitap-export.pdf') {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Charitap Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; border-bottom: 3px solid #FCD34D; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #FCD34D; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          .total { font-weight: bold; background-color: #FEF3C7; }
        </style>
      </head>
      <body>
        <h1>Charitap Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Charity</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${activities.map(activity => `
              <tr>
                <td>${new Date(activity.date).toLocaleDateString()}</td>
                <td>${activity.type === 'donation' ? 'Donation' : 'Round-Up'}</td>
                <td>${activity.charity}</td>
                <td>${activity.category}</td>
                <td>${activity.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="total">Total Transactions: ${activities.length}</p>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
