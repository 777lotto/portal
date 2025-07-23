// frontend/src/components/admin/AdminDayActionModal.tsx
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBlockDate: () => void;
  onAddJob: () => void;
  selectedDate: Date;
}

function AdminDayActionModal({ isOpen, onClose, onBlockDate, onAddJob, selectedDate }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select Action for {format(selectedDate, 'MMMM do, yyyy')}</h2>
        <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">What would you like to do?</p>
        <div className="flex justify-around items-center mt-6">
          <button onClick={onBlockDate} className="btn btn-info" style={{ minWidth: '120px' }}>
            Block Date
          </button>
          <button onClick={onAddJob} className="btn btn-primary" style={{ minWidth: '120px' }}>
            Add Job
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

export default AdminDayActionModal;
