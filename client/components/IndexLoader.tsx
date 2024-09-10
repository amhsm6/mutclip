"use client";

import React from "react";
import ClipLoader from "react-spinners/ClipLoader";
import styles from "./IndexLoader.module.css";

export default function IndexLoader(): React.ReactNode {
    return (
        <div className={ styles.container }>
            <ClipLoader />
        </div>
    );
}
