// frontend/src/components/admin/InitialJobTypeModal.tsx
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'quote' | 'job' | 'invoice') => void;
  selectedDate: Date;
}

function InitialJobTypeModal({ isOpen, onClose, onSelectType, selectedDate }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select an action for {format(selectedDate, 'MMMM do, yyyy')}</h2>
        <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">What would you like to create?</p>
        <div className="flex justify-around items-center mt-6">
          <button onClick={() => onSelectType('quote')} className="btn btn-info" style={{ minWidth: '120px' }}>
            Quote
          </button>
          <button onClick={() => onSelectType('job')} className="btn btn-primary" style={{ minWidth: '120px' }}>
            Job
          </button>
          <button onClick={() => onSelectType('invoice')} className="btn btn-success" style={{ minWidth: '120px' }}>
            Invoice
          </button>
        </div>
        <div className="text-center mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
}

export default InitialJobTypeModal;
