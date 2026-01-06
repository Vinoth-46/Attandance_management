import { useState } from 'react';
import PropTypes from 'prop-types';

export default function PeriodWiseView({ data, onStudentClick, onPeriodClick }) {
    const [selectedDate, setSelectedDate] = useState(data.date || new Date().toISOString().split('T')[0]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Present':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
            case 'Absent':
                return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
            case 'Late':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
            default:
                return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
        }
    };

    const getStatusBgColor = (status) => {
        switch (status) {
            case 'Present':
                return 'bg-emerald-500/10';
            case 'Absent':
                return 'bg-rose-500/10';
            case 'Late':
                return 'bg-amber-500/10';
            default:
                return 'bg-slate-500/10';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Date Picker */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white">Period-Wise Attendance</h3>
                    <p className="text-slate-400 text-sm mt-1">
                        {data.class?.department} - Year {data.class?.year}
                        {data.class?.section && ` - Section ${data.class?.section}`}
                    </p>
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="premium-input w-auto"
                />
            </div>

            {/* Period Summary Cards */}
            {data.periods && data.periods.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {data.periods.map((period) => {
                        const summary = data.classSummary?.[period];
                        const isSelected = selectedPeriod === period;
                        return (
                            <button
                                key={period}
                                onClick={() => {
                                    setSelectedPeriod(isSelected ? null : period);
                                    if (onPeriodClick) onPeriodClick(period);
                                }}
                                className={`glass-card-dark p-4 rounded-lg text-left transition-all ${isSelected ? 'ring-2 ring-teal-500 border-teal-500/40' : 'hover:border-teal-500/20'
                                    }`}
                            >
                                <div className="text-xs text-slate-500 mb-1">Period {period}</div>
                                <div className="text-2xl font-bold text-white">{summary?.present || 0}</div>
                                <div className="text-xs text-slate-400 mt-1">
                                    <span className="text-emerald-400">{summary?.present || 0}P</span>
                                    {' / '}
                                    <span className="text-rose-400">{summary?.absent || 0}A</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {summary?.total ? `${Math.round((summary.present / summary.total) * 100)}%` : '0%'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Attendance Grid */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                                    Student
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                                    Roll No
                                </th>
                                {data.periods?.map((period) => (
                                    <th
                                        key={period}
                                        className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase"
                                    >
                                        P{period}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                                    Summary
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.students?.map((student) => (
                                <tr
                                    key={student._id}
                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => onStudentClick && onStudentClick(student)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {student.profilePhoto ? (
                                                <img
                                                    src={student.profilePhoto}
                                                    alt={student.name}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                                                    {student.name.charAt(0)}
                                                </div>
                                            )}
                                            <span className="text-white text-sm font-medium">{student.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300 text-sm">{student.rollNumber}</td>
                                    {data.periods?.map((period) => {
                                        const attendance = student.periods?.[period];
                                        const status = attendance?.status || 'Not Marked';
                                        return (
                                            <td key={period} className="px-3 py-3">
                                                <div className="flex justify-center">
                                                    <span
                                                        className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                                                            status
                                                        )}`}
                                                    >
                                                        {status === 'Present' ? 'P' : status === 'Absent' ? 'A' : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3">
                                        <div className="text-center text-sm">
                                            <span className="text-emerald-400 font-medium">
                                                {student.summary?.present || 0}
                                            </span>
                                            <span className="text-slate-500 mx-1">/</span>
                                            <span className="text-rose-400 font-medium">
                                                {student.summary?.absent || 0}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {(!data.students || data.students.length === 0) && (
                    <div className="text-center py-12">
                        <svg
                            className="w-16 h-16 text-slate-500 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        <p className="text-slate-400">No attendance data available</p>
                    </div>
                )}
            </div>
        </div>
    );
}

PeriodWiseView.propTypes = {
    data: PropTypes.shape({
        date: PropTypes.string,
        class: PropTypes.shape({
            department: PropTypes.string,
            year: PropTypes.string,
            section: PropTypes.string
        }),
        periods: PropTypes.arrayOf(PropTypes.string),
        classSummary: PropTypes.object,
        students: PropTypes.arrayOf(
            PropTypes.shape({
                _id: PropTypes.string.isRequired,
                name: PropTypes.string.isRequired,
                rollNumber: PropTypes.string.isRequired,
                profilePhoto: PropTypes.string,
                periods: PropTypes.object,
                summary: PropTypes.shape({
                    present: PropTypes.number,
                    absent: PropTypes.number,
                    total: PropTypes.number
                })
            })
        )
    }).isRequired,
    onStudentClick: PropTypes.func,
    onPeriodClick: PropTypes.func
};
