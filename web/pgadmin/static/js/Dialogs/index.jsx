/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2022, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import React from 'react';
import ReactDOM from 'react-dom';
import pgAdmin from 'sources/pgadmin';
import ConnectServerContent from './ConnectServerContent';
import Theme from 'sources/Theme';
import url_for from 'sources/url_for';
import gettext from 'sources/gettext';

import getApiInstance from '../api_instance';
import Notify from '../helpers/Notifier';
import MasterPasswordContent from './MasterPasswordContent';
import ChangePasswordContent from './ChangePasswordContent';
import NamedRestoreContent from './NamedRestoreContent';
import ChangeOwnershipContent from './ChangeOwnershipContent';

function mountDialog(title, getDialogContent, docker=undefined) {
  // Register dialog panel
  var panel;
  if (docker) {
    pgAdmin.Browser.Node.registerUtilityPanel(docker);
    panel = pgAdmin.Browser.Node.addUtilityPanel(pgAdmin.Browser.stdW.md, undefined, docker);
  } else {
    pgAdmin.Browser.Node.registerUtilityPanel();
    panel = pgAdmin.Browser.Node.addUtilityPanel(pgAdmin.Browser.stdW.md);
  }

  var j = panel.$container.find('.obj_properties').first();
  panel.title(title);

  const onClose = ()=> {
    ReactDOM.unmountComponentAtNode(j[0]);
    panel.close();
  };

  const setNewSize = (width, height)=> {
    // Add height of the header
    let newHeight = height + 31;
    // Set min and max size of the panel
    panel.minSize(width, newHeight);
    panel.maxSize(width, newHeight);
    panel.maximisable(false);
    /* No other way to update size, below is the only way */
    panel._parent._size.x = width;
    panel._parent._size.y = newHeight;
    panel._parent.__update();
  };

  ReactDOM.render(getDialogContent(onClose, setNewSize), j[0]);
}

// This functions is used to show the connect server password dialog.
export function showServerPassword() {
  var title = arguments[0],
    formJson = arguments[1],
    nodeObj = arguments[2],
    nodeData = arguments[3],
    treeNodeInfo = arguments[4],
    itemNodeData = arguments[5],
    status = arguments[6],
    onSuccess = arguments[7],
    onFailure = arguments[8];

  mountDialog(title, (onClose, setNewSize)=> {
    return <Theme>
      <ConnectServerContent
        setHeight={(containerHeight)=>{
          setNewSize(pgAdmin.Browser.stdW.md, containerHeight);
        }}
        closeModal={()=>{
          onClose();
        }}
        data={formJson}
        onOK={(formData)=>{
          const api = getApiInstance();
          var _url = nodeObj.generate_url(itemNodeData, 'connect', nodeData, true);
          if (!status) {
            treeNodeInfo.setLeaf(itemNodeData);
            treeNodeInfo.removeIcon(itemNodeData);
            treeNodeInfo.addIcon(itemNodeData, {icon: 'icon-server-connecting'});
          }

          api.post(_url, formData)
            .then(res=>{
              onClose();
              return onSuccess(
                res.data, nodeObj, nodeData, treeNodeInfo, itemNodeData, status
              );
            })
            .catch((err)=>{
              return onFailure(
                err.response.request, status, err, nodeObj, nodeData, treeNodeInfo,
                itemNodeData, status
              );
            });
        }}
      />
    </Theme>;
  });
}

// This functions is used to show the connect server password dialog when
// launch from Schema Diff tool.
export function showSchemaDiffServerPassword() {
  var docker = arguments[0],
    title = arguments[1],
    formJson = arguments[2],
    serverID = arguments[3],
    successCallback = arguments[4],
    onSuccess = arguments[5],
    onFailure = arguments[6];

  mountDialog(title, (onClose, setNewSize)=> {
    return <Theme>
      <ConnectServerContent
        setHeight={(containerHeight)=>{
          setNewSize(pgAdmin.Browser.stdW.md, containerHeight);
        }}
        closeModal={()=>{
          onClose();
        }}
        data={formJson}
        onOK={(formData)=>{
          const api = getApiInstance();
          var _url = url_for('schema_diff.connect_server', {'sid': serverID});

          api.post(_url, formData)
            .then(res=>{
              onClose();
              return onSuccess(res.data, successCallback);
            })
            .catch((err)=>{
              return onFailure(
                err.response.request, status, err, serverID, successCallback
              );
            });
        }}
      />
    </Theme>;
  }, docker);
}

function masterPassCallbacks(masterpass_callback_queue) {
  while(masterpass_callback_queue.length > 0) {
    let callback = masterpass_callback_queue.shift();
    callback();
  }
}

export function checkMasterPassword(data, masterpass_callback_queue, cancel_callback) {
  const api = getApiInstance();
  api.post(url_for('browser.set_master_password'), data).then((res)=> {
    if(!res.data.data.present) {
      showMasterPassword(res.data.data.reset, res.data.data.errmsg, masterpass_callback_queue, cancel_callback);
    } else {
      masterPassCallbacks(masterpass_callback_queue);
    }
  }).catch(function(xhr, status, error) {
    Notify.pgRespErrorNotify(xhr, error);
  });
}

// This functions is used to show the master password dialog.
export function showMasterPassword(isPWDPresent, errmsg, masterpass_callback_queue, cancel_callback) {
  const api = getApiInstance();
  let title =  isPWDPresent ? gettext('Unlock Saved Passwords') : gettext('Set Master Password');

  mountDialog(title, (onClose, setNewSize)=> {
    return <Theme>
      <MasterPasswordContent
        isPWDPresent= {isPWDPresent}
        data={{'errmsg': errmsg}}
        setHeight={(containerHeight) => {
          setNewSize(pgAdmin.Browser.stdW.md, containerHeight);
        }}
        closeModal={() => {
          onClose();
        }}
        onResetPassowrd={()=>{
          Notify.confirm(gettext('Reset Master Password'),
            gettext('This will remove all the saved passwords. This will also remove established connections to '
            + 'the server and you may need to reconnect again. Do you wish to continue?'),
            function() {
              var _url = url_for('browser.reset_master_password');

              api.delete(_url)
                .then(() => {
                  onClose();
                  showMasterPassword(false, null, masterpass_callback_queue, cancel_callback);
                })
                .catch((err) => {
                  Notify.error(err.message);
                });
              return true;
            },
            function() {/* If user clicks No */ return true;}
          );
        }}
        onCancel={()=>{
          cancel_callback?.();
        }}
        onOK={(formData) => {
          onClose();
          checkMasterPassword(formData, masterpass_callback_queue, cancel_callback);
        }}
      />
    </Theme>;
  });
}

export function showChangeServerPassword() {
  var title = arguments[0],
    nodeData = arguments[1],
    nodeObj = arguments[2],
    itemNodeData = arguments[3],
    isPgPassFileUsed = arguments[4];

  mountDialog(title, (onClose)=> {
    return <Theme>
      <ChangePasswordContent
        onClose={()=>{
          onClose();
        }}
        onSave={(isNew, data)=>{
          return new Promise((resolve, reject)=>{
            const api = getApiInstance();
            var _url = nodeObj.generate_url(itemNodeData, 'change_password', nodeData, true);

            api.post(_url, data)
              .then(({data: respData})=>{
                Notify.success(respData.info);
                // Notify user to update pgpass file
                if(isPgPassFileUsed) {
                  Notify.alert(
                    gettext('Change Password'),
                    gettext('Please make sure to disconnect the server'
                    + ' and update the new password in the pgpass file'
                      + ' before performing any other operation')
                  );
                }

                resolve(respData.data);
                onClose();
              })
              .catch((error)=>{
                reject(error);
              });
          });
        }}
        userName={nodeData.user.name}
        isPgpassFileUsed={isPgPassFileUsed}
      />
    </Theme>;
  });
}

export function showNamedRestorePoint() {
  var title = arguments[0],
    nodeData = arguments[1],
    nodeObj = arguments[2],
    itemNodeData = arguments[3];

  mountDialog(title, (onClose, setNewSize)=> {
    return <Theme>
      <NamedRestoreContent
        setHeight={(containerHeight)=>{
          setNewSize(pgAdmin.Browser.stdW.md, containerHeight);
        }}
        closeModal={()=>{
          onClose();
        }}
        onOK={(formData)=>{
          const api = getApiInstance();
          var _url = nodeObj.generate_url(itemNodeData, 'restore_point', nodeData, true);

          api.post(_url, formData)
            .then(res=>{
              onClose();
              Notify.success(res.data.data.result);
            })
            .catch(function(xhr, status, error) {
              Notify.pgRespErrorNotify(xhr, error);
            });
        }}
      />
    </Theme>;
  });
}

export function showChangeOwnership() {
  var title = arguments[0],
    userList = arguments[1],
    noOfSharedServers = arguments[2],
    deletedUser = arguments[3],
    destroyUserManagement = arguments[4];

  // Render Preferences component
  Notify.showModal(title, (onClose) => {
    return <ChangeOwnershipContent
      onClose={()=>{
        onClose();
      }}
      onSave={(isNew, data)=>{
        const api = getApiInstance();

        return new Promise((resolve, reject)=>{
          if (data.newUser == '') {
            api.delete(url_for('user_management.user', {uid: deletedUser['uid']}))
              .then(() => {
                Notify.success(gettext('User deleted.'));
                onClose();
                destroyUserManagement();
                resolve();
              })
              .catch((err)=>{
                Notify.error(err);
                reject(err);
              });
          } else {
            let newData = {'new_owner': `${data.newUser}`, 'old_owner': `${deletedUser['uid']}`};
            api.post(url_for('user_management.change_owner'), newData)
              .then(({data: respData})=>{
                Notify.success(gettext(respData.info));
                onClose();
                destroyUserManagement();
                resolve(respData.data);
              })
              .catch((err)=>{
                reject(err);
              });
          }
        });
      }}
      userList = {userList}
      noOfSharedServers = {noOfSharedServers}
      deletedUser = {deletedUser['name']}
    />;
  },
  { isFullScreen: false, isResizeable: true, showFullScreen: true, isFullWidth: true,
    dialogWidth: pgAdmin.Browser.stdW.md, dialogHeight: pgAdmin.Browser.stdH.md});
}