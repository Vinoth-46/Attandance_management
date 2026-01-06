import { useState } from 'react';
import PropTypes from 'prop-types';

export default function AbsenteeCard({ student, onEdit }) {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="glass-card-dark p-4 rounded-lg hover:border-teal-500/40 transition-all">
            <div className="flex items-center gap-4">
                {/* Student Photo */}
                <div className="flex-shrink-0">
                    {student.profilePhoto ? (
                        <img
                            src={student.profilePhoto}
                            alt={student.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-red-500/60"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/40 to-rose-500/40 border-2 border-red-500/60 flex items-center justify-center">
                            <span className="text-2xl font-bold text-white">
                                {student.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Student Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate">{student.name}</h4>
                    <p className="text-slate-400 text-sm">Roll No: {student.rollNumber}</p>
                    {student.period && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                            Period {student.period}
                        </span>
                    )}
                    {student.periods && (
                        <p className="text-xs text-slate-500 mt-1">
                            Absent in: {student.periods.join(', ')}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/20 rounded-lg transition-colors"
                        title="View Details"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    {onEdit && (
                        <button
                            onClick={() => onEdit(student)}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Edit Status"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {showDetails && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {student.email && (
                            <div>
                                <span className="text-slate-500 block">Email:</span>
                                <a href={`mailto:${student.email}`} className="text-teal-400 hover:text-teal-300">
                                    {student.email}
                                </a>
                            </div>
                        )}
                        {student.phone && (
                            <div>
                                <span className="text-slate-500 block">Phone:</span>
                                <a href={`tel:${student.phone}`} className="text-teal-400 hover:text-teal-300">
                                    {student.phone}
                                </a>
                            </div>
                        )}
                        {student.parentPhone && (
                            <div>
                                <span className="text-slate-500 block">Parent Phone:</span>
                                <a href={`tel:${student.parentPhone}`} className="text-teal-400 hover:text-teal-300">
                                    {student.parentPhone}
                                </a>
                            </div>
                        )}
                        {student.markedAt && (
                            <div>
                                <span className="text-slate-500 block">Marked At:</span>
                                <span className="text-slate-300">
                                    {new Date(student.markedAt).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

AbsenteeCard.propTypes = {
    student: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        rollNumber: PropTypes.string.isRequired,
        profilePhoto: PropTypes.string,
        email: PropTypes.string,
        phone: PropTypes.string,
        parentPhone: PropTypes.string,
        period: PropTypes.string,
        periods: PropTypes.arrayOf(PropTypes.string),
        markedAt: PropTypes.string
    }).isRequired,
    onEdit: PropTypes.func
};
