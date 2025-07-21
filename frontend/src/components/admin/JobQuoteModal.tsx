// 777lotto/portal/portal-fold/frontend/src/components/admin/JobsAndQuotesTable.tsx
import { useState } from 'react';
import type { JobWithDetails, Service } from '@portal/shared';

interface Props {
  data: JobWithDetails[];
}

function JobsAndQuotesTable({ data }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getStatusClass = (status: string) => {
    if (status.includes('quote')) return 'bg-purple-100 text-purple-800';
    if (status.includes('pending')) return 'bg-yellow-100 text-yellow-800';
    if (status === 'paid' || status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'past_due') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
        <thead className="bg-secondary-light dark:bg-secondary-dark">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider"></th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Customer</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Job/Quote Title</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Total Amount</th>
          </tr>
        </thead>
        <tbody className="bg-primary-light dark:bg-tertiary-dark divide-y divide-border-light dark:divide-border-dark">
          {data.map((item) => (
            <>
              <tr key={item.id} className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(item.id)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {item.services.length > 0 && (
                    <span className="text-xl text-text-secondary-light dark:text-text-secondary-dark">{expandedRow === item.id ? '−' : '+'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{item.customerName}</div>
                  <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{item.customerAddress}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary-light dark:text-text-primary-dark">{item.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  ${((item.total_amount_cents || 0) / 100).toFixed(2)}
                </td>
              </tr>
              {expandedRow === item.id && (
                <tr className="bg-gray-50 dark:bg-black/20">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="pl-8">
                      <h4 className="text-md font-semibold mb-2 text-text-primary-light dark:text-text-primary-dark">Line Items</h4>
                      {item.services.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                           <thead className="bg-gray-100 dark:bg-secondary-dark">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="bg-white dark:bg-tertiary-dark divide-y divide-gray-200 dark:divide-border-dark">
                              {item.services.map((service: Service) => (
                                <tr key={service.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{service.notes}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-text-primary-light dark:text-text-primary-dark">${((service.price_cents || 0) / 100).toFixed(2)}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No line items for this entry.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default JobsAndQuotesTable;
