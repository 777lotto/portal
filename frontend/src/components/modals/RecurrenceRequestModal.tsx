// frontend/src/components/modals/RecurrenceRequestModal.tsx
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { Job } from '@portal/shared';

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

function RecurrenceRequestModal({ isOpen, onClose, job, onSuccess }: Props) {
	const [frequency, setFrequency] = useState(30);
	const [requestedDay, setRequestedDay] = useState<number | undefined>(new Date(job.start).getDay());
	const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			const fetchUnavailableDays = async () => {
				try {
					const data = await api.jobs.recurrence['unavailable-days'].$get();
					setUnavailableDays(data.unavailableDays || []);
				} catch (err) {
					console.error(err);
					setError('Could not load scheduling data.');
				}
			};
			fetchUnavailableDays();
		}
	}, [isOpen]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			await api.jobs.recurrence.request[':id'].$post({
				param: { id: job.id.toString() },
				json: { frequency, requested_day: requestedDay },
			});
			onSuccess();
			onClose();
		} catch (err: any) {
            if (err instanceof HTTPException) {
                const errorJson = await err.response.json().catch(() => ({}));
                setError(errorJson.error || 'Failed to submit recurrence request.');
            } else {
			    setError(err.message || 'An unknown error occurred.');
            }
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) return null;

	return (
        // ... JSX is unchanged ...
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
				<h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Request Recurrence for "{job.title}"</h2>
				{error && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
						<strong className="font-bold">Error: </strong>
						<span className="block sm:inline">{error}</span>
					</div>
				)}
				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<label htmlFor="frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							How often?
						</label>
						<div className="flex items-center">
							<span className="text-gray-500 dark:text-gray-400 mr-2">Once every</span>
							<input
								type="number"
								id="frequency"
								className="block w-24 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								value={frequency}
								onChange={(e) => setFrequency(parseInt(e.target.value, 10))}
								min="1"
							/>
							<span className="text-gray-500 dark:text-gray-400 ml-2">days</span>
						</div>
					</div>
					<div className="mb-4">
						<label htmlFor="requested_day" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Preferred day of the week
						</label>
						<select
							id="requested_day"
							className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
							value={requestedDay ?? ''}
							onChange={(e) => {
								const value = e.target.value;
								setRequestedDay(value === '' ? undefined : parseInt(value, 10));
							}}
						>
							<option value="">Any day</option>
							{weekDays.map((day) => (
								<option key={day.value} value={day.value} disabled={unavailableDays.includes(day.value)}>
									{day.label} {unavailableDays.includes(day.value) ? '(Unavailable)' : ''}
								</option>
							))}
						</select>
					</div>
					<div className="flex justify-end items-center mt-6">
						<button
							type="button"
							onClick={onClose}
							className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 mr-2"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Submitting...' : 'Submit Request'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default RecurrenceRequestModal;
