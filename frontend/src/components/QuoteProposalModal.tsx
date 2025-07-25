import React from 'react';

interface QuoteProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onRevise: (revisionReason: string) => void;
  jobId: string;
}

const QuoteProposalModal: React.FC<QuoteProposalModalProps> = ({ isOpen, onClose, onConfirm, onDecline, onRevise }) => {
  const [revisionReason, setRevisionReason] = React.useState('');

  if (!isOpen) {
    return null;
  }

  const handleRevise = () => {
    if (revisionReason.trim()) {
      onRevise(revisionReason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-4">Quote Proposal</h2>
        <p className="mb-4">What would you like to do with this quote?</p>
        
        <div className="mb-4">
          <label htmlFor="revision-reason" className="block text-sm font-medium text-gray-700">
            Reason for Revision (if applicable)
          </label>
          <textarea
            id="revision-reason"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={3}
            placeholder="e.g., Please adjust the pricing for service X."
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">
            Cancel
          </button>
          <button onClick={onDecline} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
            Decline
          </button>
          <button onClick={handleRevise} disabled={!revisionReason.trim()} className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
            Revise
          </button>
          <button onClick={onConfirm} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteProposalModal;
