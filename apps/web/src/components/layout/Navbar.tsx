import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react';
import {
  Bars3Icon,
  HomeIcon,
  CalendarDaysIcon,
  PuzzlePieceIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'nav.dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'nav.lanpas', href: '/lanpas', icon: CalendarDaysIcon },
  { name: 'nav.games', href: '/games', icon: PuzzlePieceIcon },
  { name: 'nav.punishments', href: '/punishments', icon: ExclamationTriangleIcon },
  { name: 'nav.stats', href: '/stats', icon: ChartBarIcon },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex">
            <Link to="/dashboard" className="flex items-center flex-shrink-0">
              <span className="text-2xl font-bold text-gradient">LanpApp</span>
            </Link>

            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
                      transition-colors duration-200
                      ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5 mr-1.5" />
                    {t(item.name)}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <Menu as="div" className="relative">
              <MenuButton className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                <GlobeAltIcon className="h-5 w-5" />
              </MenuButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 mt-2 w-32 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          onClick={() => changeLanguage('en')}
                          className={`${
                            focus ? 'bg-gray-100' : ''
                          } ${i18n.language === 'en' ? 'text-primary-600 font-medium' : 'text-gray-700'} block w-full px-4 py-2 text-left text-sm`}
                        >
                          English
                        </button>
                      )}
                    </MenuItem>
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          onClick={() => changeLanguage('es')}
                          className={`${
                            focus ? 'bg-gray-100' : ''
                          } ${i18n.language === 'es' ? 'text-primary-600 font-medium' : 'text-gray-700'} block w-full px-4 py-2 text-left text-sm`}
                        >
                          Espanol
                        </button>
                      )}
                    </MenuItem>
                  </div>
                </MenuItems>
              </Transition>
            </Menu>

            {/* User Menu */}
            <Menu as="div" className="relative">
              <MenuButton className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.display_name?.charAt(0).toUpperCase() ||
                        user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {user?.display_name || user?.username}
                </span>
              </MenuButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <MenuItem>
                      {({ focus }) => (
                        <Link
                          to="/profile"
                          className={`${
                            focus ? 'bg-gray-100' : ''
                          } flex items-center px-4 py-2 text-sm text-gray-700`}
                        >
                          <UserCircleIcon className="h-5 w-5 mr-2" />
                          {t('nav.profile')}
                        </Link>
                      )}
                    </MenuItem>
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          onClick={logout}
                          className={`${
                            focus ? 'bg-gray-100' : ''
                          } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                          {t('auth.logout')}
                        </button>
                      )}
                    </MenuItem>
                  </div>
                </MenuItems>
              </Transition>
            </Menu>

            {/* Mobile menu button */}
            <Menu as="div" className="sm:hidden relative">
              <MenuButton className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                <Bars3Icon className="h-6 w-6" />
              </MenuButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    {navigation.map((item) => (
                      <MenuItem key={item.name}>
                        {({ focus }) => (
                          <Link
                            to={item.href}
                            className={`${
                              focus ? 'bg-gray-100' : ''
                            } flex items-center px-4 py-2 text-sm text-gray-700`}
                          >
                            <item.icon className="h-5 w-5 mr-2" />
                            {t(item.name)}
                          </Link>
                        )}
                      </MenuItem>
                    ))}
                  </div>
                </MenuItems>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </nav>
  );
}
