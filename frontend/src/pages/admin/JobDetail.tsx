import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { JobWithDetails, LineItem, PhotoWithNotes, Note, User } from '@portal/shared';

function JobDetail() {
	const { jobId } = useParams<{ jobId: string }>();
	const [job, setJob] = useState<JobWithDetails | null>(null);
	const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
	const [notes, setNotes] = useState<Note[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newNote, setNewNote] = useState('');

	const fetchData = useCallback(async () => {
		if (!jobId) return;
		setIsLoading(true);
		setError(null);
		try {
			// Fetch job, photos, and notes in parallel for faster loading
			const [jobRes, photosRes, notesRes] = await Promise.all([
				api.admin.jobs[':job_id'].$get({ param: { job_id: jobId } }),
				api.admin.jobs[':job_id'].photos.$get({ param: { job_id: jobId } }),
				api.admin.jobs[':job_id'].notes.$get({ param: { job_id: jobId } }),
			]);

			// REFACTORED: Correctly parse JSON and access the data envelope
			const jobData = await jobRes.json();
			const photosData = await photosRes.json();
			const notesData = await notesRes.json();

			setJob(jobData.job);
			setPhotos(photosData.photos);
			setNotes(notesData.notes);
		} catch (err) {
			if (err instanceof HTTPException) {
				const errorJson = await err.response.json();
				setError(errorJson.message || 'Failed to fetch job details.');
			} else {
				setError('An unexpected error occurred.');
			}
		} finally {
			setIsLoading(false);
		}
	}, [jobId]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleNoteSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newNote.trim() || !jobId) return;
		try {
			const res = await api.admin.jobs[':job_id'].notes.$post({
				param: { job_id: jobId },
				json: { content: newNote },
			});
			const data = await res.json();
			setNotes((prevNotes) => [data.note, ...prevNotes]);
			setNewNote('');
		} catch (err) {
			console.error('Failed to add note:', err);
			alert('Could not add note.');
		}
	};

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			if (acceptedFiles.length === 0 || !jobId || !job?.user_id) return;
			const file = acceptedFiles[0];
			const formData = new FormData();
			formData.append('file', file);
			formData.append('job_id', jobId);
			formData.append('user_id', job.user_id.toString());

			try {
				const res = await api.admin.photos.$post({ form: formData });
				const data = await res.json();
				setPhotos((prevPhotos) => [data.photo, ...prevPhotos]);
			} catch (err) {
				console.error('Failed to upload photo:', err);
				alert('Photo upload failed.');
			}
		},
		[jobId, job?.user_id]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

	if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
	if (error) return <div className="alert alert-danger m-4">{error}</div>;
	if (!job) return <div className="text-center p-8">Job not found.</div>;

	return (
		<div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
			<div className="card">
				<div className="card-body">
					<h1 className="card-title text-3xl">{job.title}</h1>
					<p>
						<strong>Customer:</strong> {job.customerName}
					</p>
					<p>
						<strong>Status:</strong> <span className="badge badge-ghost">{job.status.replace(/_/g, ' ')}</span>
					</p>
					<p>
						<strong>Address:</strong> {job.customerAddress}
					</p>
					<p>
						<strong>Total:</strong> ${(job.total_amount_cents / 100).toFixed(2)}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="card">
					<div className="card-header">
						<h3 className="card-title text-xl">Line Items</h3>
					</div>
					<div className="card-body">
						<table className="table w-full">
							<tbody>
								{job.line_items.map((item) => (
									<tr key={item.id}>
										<td>{item.description}</td>
										<td className="text-right">${(item.unit_total_amount_cents / 100).toFixed(2)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="card">
					<div className="card-header">
						<h3 className="card-title text-xl">Photos</h3>
					</div>
					<div className="card-body">
						<div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragActive ? 'border-primary' : 'border-gray-300'}`}>
							<input {...getInputProps()} />
							<p>Drag 'n' drop some files here, or click to select files</p>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
							{photos.map((photo) => (
								<img key={photo.id} src={photo.url} alt="Job site" className="rounded-lg object-cover aspect-square" />
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="card">
				<div className="card-header">
					<h3 className="card-title text-xl">Notes</h3>
				</div>
				<div className="card-body">
					<form onSubmit={handleNoteSubmit} className="flex gap-2 mb-4">
						<input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="form-control flex-grow" placeholder="Add a new note..." />
						<button type="submit" className="btn btn-primary">
							Add Note
						</button>
					</form>
					<ul className="space-y-4">
						{notes.map((note) => (
							<li key={note.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
								<p className="text-sm">{note.content}</p>
								<small className="text-gray-500">{new Date(note.createdAt).toLocaleString()}</small>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

export default JobDetail;
