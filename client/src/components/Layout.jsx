import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
    Bars3Icon,
    XMarkIcon,
    HomeIcon,
    UsersIcon,
    CalendarIcon,
    ChartBarIcon,
    DocumentTextIcon,
    ArrowLeftOnRectangleIcon,
    CalendarDaysIcon,
    AcademicCapIcon,
    ShieldCheckIcon,
    TableCellsIcon,
    SparklesIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { user, logout, refreshUser } = useAuth()
    const { socket } = useSocket()
    const location = useLocation()

    // Listen for real-time role updates
    useEffect(() => {
        if (!socket || !user) return;

        const handleStaffUpdate = (data) => {
            if (data.staffId === user._id) {
                console.log('Role updated, refreshing profile...');
                refreshUser();
            }
        };

        socket.on('staff:update', handleStaffUpdate);

        return () => {
            socket.off('staff:update', handleStaffUpdate);
        };
    }, [socket, user, refreshUser]);

    // Super Admin navigation
    const superAdminNavigation = [
        { name: 'Dashboard', href: '/superadmin/dashboard?view=stats', icon: HomeIcon },
        { name: 'Staff Management', href: '/superadmin/dashboard?view=staff', icon: UsersIcon },
        { name: 'Faculty Advisors', href: '/superadmin/dashboard?view=advisors', icon: AcademicCapIcon },
    ];

    // Build staff navigation dynamically based on Faculty Advisor status
    const staffNavigation = [
        ...(user?.isFacultyAdvisor ? [
            { name: 'My Class', href: '/staff/dashboard?view=myclass', icon: HomeIcon },
            { name: 'Students', href: '/staff/dashboard?view=students', icon: UsersIcon },
        ] : []),
        { name: 'Attendance', href: '/staff/dashboard?view=session', icon: CalendarDaysIcon },
        { name: 'Period-Wise', href: '/staff/dashboard?view=period-wise', icon: TableCellsIcon },
        ...(user?.isFacultyAdvisor ? [{ name: 'Leave Requests', href: '/staff/dashboard?view=leaves', icon: DocumentTextIcon }] : []),
        { name: 'Reports', href: '/staff/dashboard?view=reports', icon: ChartBarIcon },
    ];

    // Determine which navigation to show based on role
    const navigation = user?.role === 'student' ? [
        { name: 'Dashboard', href: '/student/dashboard?view=dashboard', icon: HomeIcon },
        { name: 'My Profile', href: '/student/dashboard?view=profile', icon: UsersIcon },
        { name: 'Apply Leave', href: '/student/dashboard?view=leave', icon: CalendarIcon },
    ] : user?.role === 'superadmin' ? superAdminNavigation : staffNavigation;

    const SidebarContent = ({ mobile = false }) => (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto glass-sidebar px-6 pb-4">
            {/* Logo */}
            <div className="flex h-20 shrink-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30">
                    <SparklesIcon className="h-7 w-7 text-white" />
                </div>
                <div>
                    <span className="text-xl font-bold text-white tracking-tight">EduManage</span>
                    <p className="text-xs text-slate-400">Attendance System</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Navigation</p>
                        <ul role="list" className="space-y-1">
                            {navigation.map((item) => {
                                const isActive = (location.pathname + location.search) === item.href ||
                                    (item.href.includes('?view=students') && location.pathname === '/staff/dashboard' && !location.search) ||
                                    (item.href.includes('?view=dashboard') && location.pathname === '/student/dashboard' && !location.search);
                                return (
                                    <li key={item.name}>
                                        <Link
                                            to={item.href}
                                            onClick={() => mobile && setSidebarOpen(false)}
                                            className={classNames(
                                                isActive
                                                    ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white border border-white/10'
                                                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                                                'group flex gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200'
                                            )}
                                        >
                                            <item.icon className={classNames(
                                                isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300',
                                                'h-5 w-5 shrink-0 transition-colors'
                                            )} aria-hidden="true" />
                                            {item.name}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </li>

                    {/* User Profile & Logout */}
                    <li className="mt-auto">
                        {/* User Info Card */}
                        <div className="glass-card p-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                                    <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                                </div>
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                        >
                            <ArrowLeftOnRectangleIcon className="h-5 w-5 shrink-0" />
                            Sign Out
                        </button>
                    </li>
                </ul>
            </nav>
        </div>
    );

    return (
        <div className="premium-bg min-h-screen">
            {/* Mobile sidebar */}
            <Transition.Root show={sidebarOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
                    <Transition.Child
                        as={Fragment}
                        enter="transition-opacity ease-linear duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity ease-linear duration-300"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 flex">
                        <Transition.Child
                            as={Fragment}
                            enter="transition ease-in-out duration-300 transform"
                            enterFrom="-translate-x-full"
                            enterTo="translate-x-0"
                            leave="transition ease-in-out duration-300 transform"
                            leaveFrom="translate-x-0"
                            leaveTo="-translate-x-full"
                        >
                            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-in-out duration-300"
                                    enterFrom="opacity-0"
                                    enterTo="opacity-100"
                                    leave="ease-in-out duration-300"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                        <button type="button" className="-m-2.5 p-2.5 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setSidebarOpen(false)}>
                                            <span className="sr-only">Close sidebar</span>
                                            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                        </button>
                                    </div>
                                </Transition.Child>
                                <SidebarContent mobile={true} />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition.Root>

            {/* Static sidebar for desktop */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                <SidebarContent />
            </div>

            {/* Main content area */}
            <div className="lg:pl-72 relative z-10">
                {/* Header */}
                <div className="sticky top-0 z-40 glass-header">
                    <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
                        {/* Mobile menu button */}
                        <button
                            type="button"
                            className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                            <span className="text-sm font-medium">Menu</span>
                        </button>

                        {/* Separator */}
                        <div className="h-6 w-px bg-white/10 lg:hidden" aria-hidden="true" />

                        {/* Header content */}
                        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
                            <div className="flex items-center gap-4">
                                {/* Date display */}
                                <div className="hidden sm:flex items-center gap-2 text-slate-400">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span className="text-sm">
                                        {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>

                                {/* User avatar for mobile */}
                                <div className="lg:hidden h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main className="py-8">
                    <div className="px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
