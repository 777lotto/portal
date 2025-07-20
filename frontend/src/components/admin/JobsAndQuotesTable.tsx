// frontend/src/components/admin/JobsAndQuotesTable.tsx
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
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job/Quote Title</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <>
              <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(item.id)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {item.services.length > 0 && (
                    <span className="text-xl">{expandedRow === item.id ? '−' : '+'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                  <div className="text-sm text-gray-500">{item.customerAddress}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  ${((item.total_amount_cents || 0) / 100).toFixed(2)}
                </td>
              </tr>
              {expandedRow === item.id && (
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="pl-8">
                      <h4 className="text-md font-semibold mb-2">Line Items</h4>
                      {item.services.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-300">
                           <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-gray-200">
                              {item.services.map((service: Service) => (
                                <tr key={service.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{service.notes}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-700">${((service.price_cents || 0) / 100).toFixed(2)}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-500">No line items for this entry.</p>
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
