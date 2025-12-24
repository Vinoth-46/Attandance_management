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
    TableCellsIcon
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
            // If the update targets me (staffId matches my ID)
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
        // Faculty Advisors get My Class and Students tabs
        ...(user?.isFacultyAdvisor ? [
            { name: 'My Class', href: '/staff/dashboard?view=myclass', icon: HomeIcon },
            { name: 'Students', href: '/staff/dashboard?view=students', icon: UsersIcon },
        ] : []),
        // All staff get Attendance and Reports
        { name: 'Attendance', href: '/staff/dashboard?view=session', icon: CalendarDaysIcon },
        { name: 'Period-Wise Attendance', href: '/staff/dashboard?view=period-wise', icon: TableCellsIcon },
        ...(user?.isFacultyAdvisor ? [{ name: 'Leave Requests', href: '/staff/dashboard?view=leaves', icon: DocumentTextIcon }] : []),
        { name: 'Reports', href: '/staff/dashboard?view=reports', icon: ChartBarIcon },
    ];

    // Determine which navigation to show based on role
    const navigation = user?.role === 'student' ? [
        { name: 'Dashboard', href: '/student/dashboard?view=dashboard', icon: HomeIcon },
        { name: 'My Profile', href: '/student/dashboard?view=profile', icon: UsersIcon },
        { name: 'Apply Leave', href: '/student/dashboard?view=leave', icon: CalendarIcon },
    ] : user?.role === 'superadmin' ? superAdminNavigation : staffNavigation;


    // Since we used Tabs inside the page previously, let's keep it simple or migrate to true routing.
    // For "Professional" look, sidebar navigation is better than in-page tabs.
    // I will assume we migrate to sub-routes or keep using the Dashboard page with query params/state?
    // Let's stick to the Tab approach for now but style the Sidebar to *look* like it controls it, 
    // or actually make them links. For valid links, we need separate routes.
    // Let's stick to the unified dashboard page for simplicity of refactor, 
    // but maybe we pass a prop or use context to switch views if we want the sidebar to control it.
    // OR, we just render the sidebar and the content area is the Dashboard page which has the tabs.
    // Actually, for a visual upgrade, true sidebar navigation is best.
    // Let's just create a shell that looks good.

    return (
        <>
            <div className="h-full">
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
                            <div className="fixed inset-0 bg-gray-900/80" />
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
                                            <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                                <span className="sr-only">Close sidebar</span>
                                                <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </Transition.Child>
                                    {/* Sidebar component for mobile */}
                                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-brand-900 px-6 pb-4 ring-1 ring-white/10">
                                        <div className="flex h-16 shrink-0 items-center">
                                            <span className="text-white font-bold text-xl">EduManage</span>
                                        </div>
                                        <nav className="flex flex-1 flex-col">
                                            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                                                <li>
                                                    <ul role="list" className="-mx-2 space-y-1">
                                                        {navigation.map((item) => {
                                                            const isActive = (location.pathname + location.search) === item.href ||
                                                                (item.href.includes('?view=students') && location.pathname === '/staff/dashboard' && !location.search) ||
                                                                (item.href.includes('?view=dashboard') && location.pathname === '/student/dashboard' && !location.search);
                                                            return (
                                                                <li key={item.name}>
                                                                    <Link
                                                                        to={item.href}
                                                                        onClick={() => setSidebarOpen(false)}
                                                                        className={classNames(
                                                                            isActive
                                                                                ? 'bg-brand-800 text-white'
                                                                                : 'text-brand-100 hover:text-white hover:bg-brand-800',
                                                                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                                                        )}
                                                                    >
                                                                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                                                        {item.name}
                                                                    </Link>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </li>
                                                <li className="mt-auto">
                                                    <button onClick={logout} className="text-brand-100 hover:text-white group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold">
                                                        <ArrowLeftOnRectangleIcon className="h-6 w-6 shrink-0" />
                                                        Logout
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </Dialog>
                </Transition.Root>

                {/* Static sidebar for desktop */}
                <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-brand-900 px-6 pb-4">
                        <div className="flex h-16 shrink-0 items-center">
                            <span className="text-white font-bold text-2xl tracking-tight">EduManage</span>
                        </div>
                        <nav className="flex flex-1 flex-col">
                            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                                <li>
                                    <ul role="list" className="-mx-2 space-y-1">
                                        {navigation.map((item) => {
                                            const isActive = (location.pathname + location.search) === item.href ||
                                                (item.href.includes('?view=students') && location.pathname === '/staff/dashboard' && !location.search) ||
                                                (item.href.includes('?view=dashboard') && location.pathname === '/student/dashboard' && !location.search);
                                            return (
                                                <li key={item.name}>
                                                    <Link
                                                        to={item.href}
                                                        className={classNames(
                                                            isActive
                                                                ? 'bg-brand-800 text-white'
                                                                : 'text-brand-100 hover:text-white hover:bg-brand-800',
                                                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                                        )}
                                                    >
                                                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                                        {item.name}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                                <li className="mt-auto">
                                    <button onClick={logout} className="w-full text-left text-brand-100 hover:text-white hover:bg-brand-800 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold">
                                        <ArrowLeftOnRectangleIcon className="h-6 w-6 shrink-0" />
                                        Logout
                                    </button>
                                    <div className="mt-4 border-t border-brand-800 pt-4">
                                        <div className="flex items-center">
                                            <div className="ml-0">
                                                <p className="text-sm font-medium text-white">{user?.name}</p>
                                                <p className="text-xs font-medium text-brand-200 capitalize">{user?.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>

                <div className="lg:pl-72">
                    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
                        <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
                            <span className="sr-only">Open sidebar</span>
                            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                        </button>
                        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
                            <span className="text-sm text-gray-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                    </div>

                    <main className="py-10">
                        <div className="px-4 sm:px-6 lg:px-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </>
    )
}
