import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { Job } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	job: Job;
	onSuccess: () => void;
}

const weekDays = [
	{ label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 },
	{ label: 'Tuesday', value: 2 }, { label: 'Wednesday', value: 3 },
	{ label: 'Thursday', value: 4 }, { label: 'Friday', value: 5 },
	{ label: 'Saturday', value: 6 },
];

const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof HTTPException) {
    try {
      const data = await error.response.json();
      return data.message || data.error || 'An unexpected error occurred.';
    } catch (e) {
      return 'An unexpected error occurred parsing the error response.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
};

function RecurrenceRequestModal({ isOpen, onClose, job, onSuccess }: Props) {
  const queryClient = useQueryClient();
	const [frequency, setFrequency] = useState(30);
	const [requestedDay, setRequestedDay] = useState<number | undefined>(new Date(job.start).getDay());
	const [error, setError] = useState<string | null>(null);

  const { data: unavailableDays, isLoading: isLoadingDays } = useQuery<number[], Error>({
    queryKey: ['jobs', 'recurrence', 'unavailable-days'],
    queryFn: async () => {
      const res = await api.jobs.recurrence['unavailable-days'].$get();
      if (!res.ok) throw new HTTPException(res.status, { res });
      const data = await res.json();
      return data.unavailableDays || [];
    },
    enabled: isOpen,
  });

  const { mutate: submitRequest, isPending: isSubmitting } = useMutation({
    mutationFn: () => {
      return api.jobs.recurrence.request[':id'].$post({
        param: { id: job.id.toString() },
        json: { frequency, requested_day: requestedDay },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'recurrence-requests'] });
      onSuccess();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

	useEffect(() => {
		if (isOpen) {
      setFrequency(30);
      setRequestedDay(new Date(job.start).getDay());
			setError(null);
		}
	}, [isOpen, job.start]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
    submitRequest();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div className="bg-base-100 rounded-lg p-6 w-full max-w-md shadow-xl">
				<h2 className="text-xl font-bold mb-4">Request Recurrence for "{job.title}"</h2>
				{error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="frequency" className="label"><span className="label-text">How often?</span></label>
						<div className="flex items-center gap-2">
							<span>Once every</span>
							<input
								type="number"
								id="frequency"
								className="input input-bordered w-24"
								value={frequency}
								onChange={(e) => setFrequency(parseInt(e.target.value, 10))}
								min="1"
							/>
							<span>days</span>
						</div>
					</div>
					<div>
						<label htmlFor="requested_day" className="label"><span className="label-text">Preferred day of the week</span></label>
						<select
							id="requested_day"
							className="select select-bordered w-full"
							value={requestedDay ?? ''}
							onChange={(e) => setRequestedDay(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
              disabled={isLoadingDays}
						>
							<option value="">{isLoadingDays ? "Loading..." : "Any day"}</option>
							{weekDays.map((day) => (
								<option key={day.value} value={day.value} disabled={unavailableDays?.includes(day.value)}>
									{day.label} {unavailableDays?.includes(day.value) ? '(Unavailable)' : ''}
								</option>
							))}
						</select>
					</div>
					<div className="flex justify-end items-center mt-6 gap-2">
						<button type="button" onClick={onClose} className="btn btn-ghost">
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="loading loading-spinner"></span>}
							Submit Request
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default RecurrenceRequestModal;
